const { GoogleGenAI } = require('@google/genai');
const prisma = require('../config/prisma');
const folderModel = require('../models/folders.model');
const supabase = require('../config/supabase');
const { extOf } = require('../config/fileTypes');
const {
  embedTexts,
  ingestFileForRag,
  INDEXABLE_EXTS,
} = require('./ragIngestion.service');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const BUCKET = 'pdfs';

// Automatically falls back across Gemini models on 503/429/404 or slow responses
async function generateContentWithFallback(prompt) {
  const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          abortSignal: AbortSignal.timeout(8000),
        },
      });
      return response;
    } catch (error) {
      lastError = error;
      const msg = String(error?.message || '');
      const retryable =
        error?.status === 503 ||
        error?.status === 429 ||
        error?.status === 404 ||
        error?.name === 'TimeoutError' ||
        error?.name === 'AbortError' ||
        msg.includes('503') ||
        msg.includes('429') ||
        msg.includes('timeout');

      if (retryable) {
        console.warn(`⚠️ Model ${model} failed/timed out (${error?.status || error?.name}). Trying fallback model...`);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

// Index any older files (uploaded before RAG was added) if they are queried
async function ensureFilesIndexed(userId, scopedFileIds) {
  const where = {
    userId,
    ragStatus: 'NONE',
    ...(scopedFileIds !== null ? { id: { in: scopedFileIds } } : {}),
  };

  const unindexed = await prisma.file.findMany({
    where,
    select: { id: true, path: true, originalname: true },
  });

  for (const file of unindexed) {
    const ext = extOf(file.originalname);
    if (!INDEXABLE_EXTS.has(ext)) continue;

    const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
    if (error || !data) continue;

    const buffer = Buffer.from(await data.arrayBuffer());
    await ingestFileForRag({ buffer, ext, fileId: file.id, userId });
  }
}

// Resolve the union of selected fileIds + all files inside selected folder subtrees
async function resolveScopedFileIds({ userId, fileIds = [], folderIds = [] }) {
  const hasFiles = Array.isArray(fileIds) && fileIds.length > 0;
  const hasFolders = Array.isArray(folderIds) && folderIds.length > 0;

  if (!hasFiles && !hasFolders) {
    return null; // null = search across all files in user's Drive
  }

  const allowedIds = new Set();

  if (hasFiles) {
    const ownedFiles = await prisma.file.findMany({
      where: { userId, id: { in: fileIds } },
      select: { id: true },
    });
    ownedFiles.forEach((f) => allowedIds.add(f.id));
  }

  if (hasFolders) {
    const allSubtreeFolderIds = new Set();
    for (const fId of folderIds) {
      const owned = await folderModel.findOwned(fId, userId);
      if (owned) {
        const subIds = await folderModel.subtreeIds(fId, userId);
        subIds.forEach((id) => allSubtreeFolderIds.add(id));
      }
    }

    if (allSubtreeFolderIds.size > 0) {
      const folderFiles = await prisma.file.findMany({
        where: { userId, folderId: { in: [...allSubtreeFolderIds] } },
        select: { id: true },
      });
      folderFiles.forEach((f) => allowedIds.add(f.id));
    }
  }

  return [...allowedIds];
}

// Hybrid Search (pgvector cosine + Postgres tsvector BM25) fused via Reciprocal Rank Fusion (RRF)
async function hybridSearchRRF({ userId, query, scopedFileIds, limit = 10 }) {
  const [queryVec] = await embedTexts([query]);
  const vectorLiteral = `[${queryVec.join(',')}]`;

  if (scopedFileIds !== null) {
    if (scopedFileIds.length === 0) return [];

    return prisma.$queryRaw`
      WITH semantic AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> ${vectorLiteral}::vector(768)) AS rank
        FROM document_chunks
        WHERE user_id = ${userId}::uuid AND file_id = ANY(${scopedFileIds}::uuid[])
        ORDER BY embedding <=> ${vectorLiteral}::vector(768)
        LIMIT 20
      ),
      keyword AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('english', ${query})) DESC) AS rank
        FROM document_chunks
        WHERE user_id = ${userId}::uuid
          AND file_id = ANY(${scopedFileIds}::uuid[])
          AND tsv @@ websearch_to_tsquery('english', ${query})
        LIMIT 20
      ),
      fused AS (
        SELECT
          COALESCE(s.id, k.id) AS id,
          COALESCE(1.0 / (60 + s.rank), 0.0) + COALESCE(1.0 / (60 + k.rank), 0.0) AS rrf_score
        FROM semantic s
        FULL OUTER JOIN keyword k ON s.id = k.id
      )
      SELECT c.id, c.file_id AS "fileId", c.chunk_index AS "chunkIndex", c.content,
             f.originalname AS "fileName", fused.rrf_score AS "rrfScore"
      FROM fused
      JOIN document_chunks c ON c.id = fused.id
      JOIN files f ON f.id = c.file_id
      ORDER BY fused.rrf_score DESC
      LIMIT ${limit}
    `;
  }

  return prisma.$queryRaw`
    WITH semantic AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> ${vectorLiteral}::vector(768)) AS rank
      FROM document_chunks
      WHERE user_id = ${userId}::uuid
      ORDER BY embedding <=> ${vectorLiteral}::vector(768)
      LIMIT 20
    ),
    keyword AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('english', ${query})) DESC) AS rank
      FROM document_chunks
      WHERE user_id = ${userId}::uuid
        AND tsv @@ websearch_to_tsquery('english', ${query})
      LIMIT 20
    ),
    fused AS (
      SELECT
        COALESCE(s.id, k.id) AS id,
        COALESCE(1.0 / (60 + s.rank), 0.0) + COALESCE(1.0 / (60 + k.rank), 0.0) AS rrf_score
      FROM semantic s
      FULL OUTER JOIN keyword k ON s.id = k.id
    )
    SELECT c.id, c.file_id AS "fileId", c.chunk_index AS "chunkIndex", c.content,
           f.originalname AS "fileName", fused.rrf_score AS "rrfScore"
    FROM fused
    JOIN document_chunks c ON c.id = fused.id
    JOIN files f ON f.id = c.file_id
    ORDER BY fused.rrf_score DESC
    LIMIT ${limit}
  `;
}

// Listwise Reranking via Jina Reranker v3.5
async function rerankChunks(query, candidates, topK = 4) {
  if (candidates.length <= topK || !process.env.JINA_API_KEY) {
    return candidates.slice(0, topK);
  }

  try {
    const response = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'jina-reranker-v3.5',
        query,
        documents: candidates.map((c) => c.content),
        top_n: topK,
        return_documents: false,
      }),
    });

    if (!response.ok) throw new Error(`Jina Rerank HTTP ${response.status}`);
    const data = await response.json();

    const reranked = (data.results || [])
      .filter((r) => r.relevance_score >= 0.05)
      .map((r) => ({
        ...candidates[r.index],
        relevanceScore: r.relevance_score,
      }));

    if (reranked.length > 0) return reranked;
  } catch (err) {
    console.warn('Reranker fallback to RRF order:', err.message);
  }

  return candidates.slice(0, topK);
}

async function askDriveRag({ userId, question, fileIds = [], folderIds = [] }) {
  console.time('[RAG] Total');
  const scopedFileIds = await resolveScopedFileIds({ userId, fileIds, folderIds });

  if (scopedFileIds !== null && scopedFileIds.length === 0) {
    console.timeEnd('[RAG] Total');
    return {
      answer: 'No documents were found in the files or folders you selected.',
      sources: [],
    };
  }

  console.time('[RAG] 1. Ensure indexed');
  await ensureFilesIndexed(userId, scopedFileIds);
  console.timeEnd('[RAG] 1. Ensure indexed');

  console.time('[RAG] 2. Hybrid search');
  const candidates = await hybridSearchRRF({ userId, query: question, scopedFileIds, limit: 10 });
  console.timeEnd('[RAG] 2. Hybrid search');

  if (!candidates.length) {
    console.timeEnd('[RAG] Total');
    return {
      answer: "I couldn't find any matching content in the selected files/folders. Make sure they are PDF, TXT, MD, or CSV documents with selectable text.",
      sources: [],
    };
  }

  console.time('[RAG] 3. Rerank');
  const topChunks = await rerankChunks(question, candidates, 4);
  console.timeEnd('[RAG] 3. Rerank');

  const contextBlock = topChunks
    .map((c, i) => `[Source ${i + 1}: ${c.fileName} | Section #${c.chunkIndex + 1}]\n${c.content}`)
    .join('\n\n---\n\n');

  const prompt = `You are CDriveX AI, an assistant answering questions strictly from the user's personal cloud drive documents.
Rules:
1. Answer using ONLY the provided context excerpts. If the answer isn't in the excerpts, say so clearly.
2. Cite your sources inline using the exact format [Filename, Section #X].
3. Be concise, clear, and well-structured.

Context:
${contextBlock}

User Question: ${question}`;

  console.time('[RAG] 4. Gemini generate');
  const completion = await generateContentWithFallback(prompt);
  console.timeEnd('[RAG] 4. Gemini generate');
  console.timeEnd('[RAG] Total');

  const uniqueSources = [];
  const seen = new Set();
  for (const chunk of topChunks) {
    if (!seen.has(chunk.fileId)) {
      seen.add(chunk.fileId);
      uniqueSources.push({
        fileId: chunk.fileId,
        fileName: chunk.fileName,
        snippet: chunk.content.slice(0, 140) + '...',
      });
    }
  }

  return {
    answer: completion.text,
    sources: uniqueSources,
  };
}

module.exports = { askDriveRag };
