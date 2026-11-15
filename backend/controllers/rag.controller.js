const prisma = require('../config/prisma');
const { extOf } = require('../config/fileTypes');
const { askDriveRag } = require('../services/ragSearch.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

async function getLibrary(req, res) {
  try {
    const { userId } = req.user;
    const [folders, files] = await Promise.all([
      prisma.folder.findMany({
        where: { userId },
        select: { id: true, name: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.file.findMany({
        where: { userId },
        select: { id: true, originalname: true, folderId: true, ragStatus: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const folderMap = new Map(folders.map((f) => [f.id, f]));
    const getPath = (folderId) => {
      const parts = [];
      let cur = folderId ? folderMap.get(folderId) : null;
      while (cur) {
        parts.unshift(cur.name);
        cur = cur.parentId ? folderMap.get(cur.parentId) : null;
      }
      return parts.length ? parts.join(' / ') : 'Your files';
    };

    const indexableFiles = files
      .filter((f) => ['pdf', 'txt', 'md', 'csv'].includes(extOf(f.originalname)))
      .map((f) => ({
        id: f.id,
        originalname: f.originalname,
        folderPath: getPath(f.folderId),
        ragStatus: f.ragStatus,
      }));

    const formattedFolders = folders.map((f) => ({
      id: f.id,
      name: f.name,
      path: getPath(f.id),
    }));

    return res.json({ folders: formattedFolders, files: indexableFiles });
  } catch (err) {
    console.error('RAG library error:', err);
    return res.status(500).json({ message: 'Could not load your files for AI.' });
  }
}

async function chat(req, res) {
  try {
    const question = String(req.body.question || '').trim();
    const fileIds = Array.isArray(req.body.fileIds)
      ? req.body.fileIds.filter(isUuid)
      : isUuid(req.body.fileId)
        ? [req.body.fileId]
        : [];
    const folderIds = Array.isArray(req.body.folderIds)
      ? req.body.folderIds.filter(isUuid)
      : isUuid(req.body.folderId)
        ? [req.body.folderId]
        : [];

    if (!question || question.length > 1000) {
      return res.status(400).json({ message: 'Enter a question up to 1000 characters.' });
    }

    const result = await askDriveRag({
      userId: req.user.userId,
      question,
      fileIds,
      folderIds,
    });

    return res.json(result);
  } catch (err) {
    console.error('RAG chat error:', err);
    return res.status(500).json({ message: 'Could not generate an answer right now.' });
  }
}

module.exports = { getLibrary, chat };
