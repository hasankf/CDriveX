const { randomUUID } = require('crypto');
const supabase = require('../config/supabase');
const fileModel = require('../models/files.model');
const folderModel = require('../models/folders.model');
const { TYPES, extOf } = require('../config/fileTypes');
const { ingestFileForRag } = require('../services/ragIngestion.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

const INVALID_UUID = '22023';
const BUCKET = 'pdfs';

async function browse(req, res) {
  try {
    const { userId } = req.user;
    const folderId = req.query.folder || null;

    let crumbs = [];
    if (folderId) {
      if (!isUuid(folderId)) return res.status(404).json({ message: 'Folder not found.' });
      crumbs = await folderModel.breadcrumbs(folderId, userId);
      if (!crumbs.length) return res.status(404).json({ message: 'Folder not found.' });
    }

    const [folders, files] = await Promise.all([
      folderModel.listChildren(userId, folderId),
      fileModel.listInFolder(userId, folderId),
    ]);
    return res.json({ folders, files, breadcrumbs: crumbs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not load your files.' });
  }
}

async function createFolder(req, res) {
  const name = String(req.body.name || '').trim();
  const parentId = req.body.parentId || null;

  if (!name || name.length > 100 || /[\\/]/.test(name)) {
    return res.status(400).json({ message: 'Enter a folder name up to 100 characters, without slashes.' });
  }

  try {
    if (parentId) {
      const parent = isUuid(parentId) && (await folderModel.findOwned(parentId, req.user.userId));
      if (!parent) return res.status(404).json({ message: 'Folder not found.' });
    }
    const folder = await folderModel.createFolder({ name, parentId, userId: req.user.userId });
    return res.status(201).json({ folder });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not create the folder.' });
  }
}

async function deleteFolder(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    if (!isUuid(id) || !(await folderModel.findOwned(id, userId))) {
      return res.status(404).json({ message: 'Folder not found.' });
    }

    const ids = await folderModel.subtreeIds(id, userId);
    const files = await fileModel.pathsInFolders(ids, userId);

    if (files.length) {
      const { error } = await supabase.storage.from(BUCKET).remove(files.map((f) => f.path));
      if (error) throw error;
    }

    await folderModel.deleteFolder(id, userId);
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not delete the folder.' });
  }
}

async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Choose a file to upload.' });
    }

    const ext = extOf(req.file.originalname);
    if (!Object.hasOwn(TYPES, ext)) {
      return res.status(415).json({ message: 'That file type isn’t supported.' });
    }

    const folderId = req.body.folderId || null;
    if (folderId) {
      const folder = isUuid(folderId) && (await folderModel.findOwned(folderId, req.user.userId));
      if (!folder) return res.status(404).json({ message: 'Folder not found.' });
    }

    const mimetype = TYPES[ext];
    const filePath = `${randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, { contentType: mimetype });
    if (error) throw error;

    const newFile = await fileModel.createFile({
      path: filePath,
      originalname: req.file.originalname,
      userId: req.user.userId,
      folderId,
      size: req.file.size,
      mimetype,
    });

    const ragStatus = await ingestFileForRag({
      buffer: req.file.buffer,
      ext,
      fileId: newFile.id,
      userId: req.user.userId,
    });

    return res.status(201).json({ file: { ...newFile, ragStatus } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Upload failed. Try again.' });
  }
}

async function getDownloadUrl(req, res) {
  try {
    const file = await fileModel.findByIdAndUser(req.params.id, req.user.userId);
    if (!file) return res.status(404).json({ message: 'File not found.' });

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.path, 60, { download: file.originalname });
    if (error) throw error;

    return res.json({ url: data.signedUrl });
  } catch (err) {
    if (err.code === INVALID_UUID) {
      return res.status(404).json({ message: 'File not found.' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Could not generate the download link.' });
  }
}

async function renameFile(req, res) {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 255 || /[\\/]/.test(name)) {
    return res.status(400).json({ message: 'Enter a name up to 255 characters, without slashes.' });
  }

  try {
    const file = await fileModel.renameFile(req.params.id, req.user.userId, name);
    if (!file) return res.status(404).json({ message: 'File not found.' });
    return res.json({ file });
  } catch (err) {
    if (err.code === INVALID_UUID) return res.status(404).json({ message: 'File not found.' });
    console.error(err);
    return res.status(500).json({ message: 'Could not rename the file.' });
  }
}

async function deleteFile(req, res) {
  try {
    const file = await fileModel.findByIdAndUser(req.params.id, req.user.userId);
    if (!file) return res.status(404).json({ message: 'File not found.' });

    const { error } = await supabase.storage.from(BUCKET).remove([file.path]);
    if (error) throw error;

    await fileModel.deleteFile(file.id, req.user.userId);
    return res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === INVALID_UUID) return res.status(404).json({ message: 'File not found.' });
    console.error(err);
    return res.status(500).json({ message: 'Could not delete the file.' });
  }
}

module.exports = {
  browse,
  createFolder,
  deleteFolder,
  uploadFile,
  getDownloadUrl,
  renameFile,
  deleteFile,
};
