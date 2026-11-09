// JSON API for the React client. Mounted at /api in app.js.
// Reuses your existing models, auth middleware, multer and supabase config.

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const upload = require('../config/multer.config');
const supabase = require('../config/supabase');
const authMiddleware = require('../middlewares/auth');
const userModel = require('../models/user.model');
const fileModel = require('../models/files.model');

const folderModel = require('../models/folders.model');
const { TYPES, extOf } = require('../config/fileTypes');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// Postgres error codes
const UNIQUE_VIOLATION = 'P2002';
const INVALID_UUID = '22023';

const BUCKET = 'pdfs';

const COOKIE_BASE = {
  httpOnly: true, // JS in the browser can't read the token
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* ------------------------------ Auth ------------------------------ */

router.post(
  '/auth/register',
  body('email').trim().isEmail().isLength({ min: 13 }),
  body('password').trim().isLength({ min: 5 }),
  body('username').trim().isLength({ min: 3 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Check your details: username 3+, email 13+, password 5+ characters.',
        errors: errors.array(),
      });
    }

    try {
      const { email, username, password } = req.body;
      const hashPassword = await bcrypt.hash(password, 10);
      await userModel.createUser({ email, username, password: hashPassword });
      return res.status(201).json({ message: 'Account created' });
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        return res.status(409).json({ message: 'That username or email is already taken.' });
      }
      console.error(err);
      return res.status(500).json({ message: 'Could not create the account. Try again.' });
    }
  }
);

router.post(
  '/auth/login',
  body('username').trim().isLength({ min: 3 }),
  body('password').trim().isLength({ min: 5 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Enter your username and password.' });
    }

    try {
      const { username, password } = req.body;
      const user = await userModel.findByUsername(username);
      const isMatch = user && (await bcrypt.compare(password, user.password));

      if (!isMatch) {
        return res.status(400).json({ message: 'Username or password is incorrect.' });
      }

      const payload = { userId: user.id, email: user.email, username: user.username };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.cookie('token', token, { ...COOKIE_BASE, maxAge: WEEK_MS });
      return res.json({ user: payload });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Could not log you in. Try again.' });
    }
  }
);

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token', COOKIE_BASE);
  res.json({ message: 'Logged out' });
});

// Lets the React app check on load whether the cookie is still valid.
router.get('/auth/me', authMiddleware, (req, res) => {
  const { userId, username, email } = req.user;
  res.json({ user: { userId, username, email } });
});

/* ------------------------------ Files ------------------------------ */

// One call returns everything shown on screen for a folder (or the top level)
router.get('/browse', authMiddleware, async (req, res) => {
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
    res.json({ folders, files, breadcrumbs: crumbs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load your files.' });
  }
});

router.post('/folders', authMiddleware, async (req, res) => {
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
    res.status(201).json({ folder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create the folder.' });
  }
});

// Deletes the folder, everything inside it, and the stored files.
router.delete('/folders/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    if (!isUuid(id) || !(await folderModel.findOwned(id, userId))) {
      return res.status(404).json({ message: 'Folder not found.' });
    }

    const ids = await folderModel.subtreeIds(id, userId);
    const files = await fileModel.pathsInFolders(ids, userId);

    // Storage first, so a failure leaves the database intact and retryable
    if (files.length) {
      const { error } = await supabase.storage.from(BUCKET).remove(files.map((f) => f.path));
      if (error) throw error;
    }
    await folderModel.deleteFolder(id, userId); // database cascade removes subfolders + file rows
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not delete the folder.' });
  }
});

// Runs multer and turns its errors into JSON the client can show.
function receiveFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'That file is larger than 10 MB.' });
    }
    return res.status(400).json({ message: err.message });
  });
}

router.post('/files', authMiddleware, receiveFile, async (req, res) => {
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

    const mimetype = TYPES[ext]; // set by us, not trusted from the browser
    const filePath = `${uuidv4()}.${ext}`;

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

    res.status(201).json({ file: newFile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload failed. Try again.' });
  }
});

// Returns a 60-second signed link. The `download` option makes the browser
// save the file under its original name instead of opening it.
router.get('/files/:id/url', authMiddleware, async (req, res) => {
  try {
    const file = await fileModel.findByIdAndUser(req.params.id, req.user.userId);
    if (!file) return res.status(404).json({ message: 'File not found.' });

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.path, 60, { download: file.originalname });
    if (error) throw error;

    res.json({ url: data.signedUrl });
  } catch (err) {
    // A malformed id in the URL lands here too.
    if (err.code === INVALID_UUID) {
      return res.status(404).json({ message: 'File not found.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Could not generate the download link.' });
  }
});

router.patch('/files/:id', authMiddleware, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 255 || /[\\/]/.test(name)) {
    return res.status(400).json({ message: 'Enter a name up to 255 characters, without slashes.' });
  }
  try {
    const file = await fileModel.renameFile(req.params.id, req.user.userId, name);
    if (!file) return res.status(404).json({ message: 'File not found.' });
    res.json({ file });
  } catch (err) {
    if (err.code === INVALID_UUID) return res.status(404).json({ message: 'File not found.' });
    console.error(err);
    res.status(500).json({ message: 'Could not rename the file.' });
  }
});

router.delete('/files/:id', authMiddleware, async (req, res) => {
  try {
    const file = await fileModel.findByIdAndUser(req.params.id, req.user.userId);
    if (!file) return res.status(404).json({ message: 'File not found.' });

    // Storage first: if this fails, the database row stays and you can retry.
    const { error } = await supabase.storage.from(BUCKET).remove([file.path]);
    if (error) throw error;

    await fileModel.deleteFile(file.id, req.user.userId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === INVALID_UUID) return res.status(404).json({ message: 'File not found.' });
    console.error(err);
    res.status(500).json({ message: 'Could not delete the file.' });
  }
});

module.exports = router;
