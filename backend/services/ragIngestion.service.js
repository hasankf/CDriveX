const { GoogleGenAI } = require('@google/genai');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const prisma = require('../config/prisma');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const INDEXABLE_EXTS = new Set(['pdf', 'txt', 'md', 'csv']);

// L2-normalize truncated 768-dim vectors from gemini-embedding-001 for accurate cosine similarity
// basically it makes, say a vector [3,4] into [0.8 0.6] which is of magnitude 1
function l2Normalize(vec) {
  const norm = Math.sqrt(vec.reduce( (sum, val) => sum + val * val, 0) ) || 1;
  return vec.map((val) => val / norm);
}


async function extractText(buffer, ext) {
  if (ext === 'pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text || '';
  }
  return buffer.toString('utf-8');
}

async function embedTexts(texts) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: texts,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings.map((e) => l2Normalize(e.values));
}

async function ingestFileForRag({ buffer, ext, fileId, userId }) {
  if (!INDEXABLE_EXTS.has(ext)) return 'NONE';

  try {
    await prisma.file.update({
      where: { id: fileId },
      data: { ragStatus: 'PROCESSING' },
    });

    const rawText = await extractText(buffer, ext);
    const cleaned = rawText.replace(/\u0000/g, '').trim();
    if (!cleaned) {
      await prisma.file.update({ where: { id: fileId }, data: { ragStatus: 'EMPTY' } });
      return 'EMPTY';
    }

    // Structural recursive chunking (preserves paragraphs & sentences)
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
    });
    const chunks = await splitter.splitText(cleaned);

    // Batch embed chunks (25 at a time to stay well within API payload limits)
    const BATCH_SIZE = 25;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const vectors = await embedTexts(batch);

      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j;
        const vectorLiteral = `[${vectors[j].join(',')}]`;
        await prisma.$executeRaw`
          INSERT INTO document_chunks (file_id, user_id, chunk_index, content, embedding)
          VALUES (${fileId}::uuid, ${userId}::uuid, ${chunkIndex}, ${batch[j]}, ${vectorLiteral}::vector(768))
        `;
      }
    }

    await prisma.file.update({
      where: { id: fileId },
      data: { ragStatus: 'INDEXED' },
    });
    return 'INDEXED';
  } catch (err) {
    console.error(`RAG ingestion failed for file ${fileId}:`, err.message);
    await prisma.file.update({
      where: { id: fileId },
      data: { ragStatus: 'FAILED' },
    });
    return 'FAILED';
  }
}

module.exports = { ingestFileForRag, embedTexts, INDEXABLE_EXTS };
