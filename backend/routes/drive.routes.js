const express = require('express');
const upload = require('../config/multer.config');
const authMiddleware = require('../middlewares/auth');
const driveController = require('../controllers/drive.controller');

const router = express.Router();

function receiveFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'That file is larger than 10 MB.' });
    }
    return res.status(400).json({ message: err.message });
  });
}

router.get('/browse', authMiddleware, driveController.browse);
router.post('/folders', authMiddleware, driveController.createFolder);
router.delete('/folders/:id', authMiddleware, driveController.deleteFolder);

router.post('/files', authMiddleware, receiveFile, driveController.uploadFile);
router.get('/files/:id/url', authMiddleware, driveController.getDownloadUrl);
router.patch('/files/:id', authMiddleware, driveController.renameFile);
router.delete('/files/:id', authMiddleware, driveController.deleteFile);

module.exports = router;
