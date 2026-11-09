const prisma = require('../config/prisma');

const publicFields = { id: true, originalname: true, createdAt: true, size: true };

function createFile({ path, originalname, userId, folderId, size, mimetype }) {
  return prisma.file.create({
    data: { path, originalname, userId, folderId, size, mimetype },
    select: publicFields,
  });
}

function listInFolder(userId, folderId) {
  return prisma.file.findMany({
    where: { userId, folderId },
    select: publicFields,
    orderBy: { createdAt: 'desc' },
  });
}

function findByIdAndUser(id, userId) {
  return prisma.file.findFirst({
    where: { id, userId },
    select: { id: true, path: true, originalname: true },
  });
}

async function renameFile(id, userId, originalname) {
  const { count } = await prisma.file.updateMany({ where: { id, userId }, data: { originalname } });
  if (!count) return null;
  return prisma.file.findUnique({ where: { id }, select: publicFields });
}

async function deleteFile(id, userId) {
  const { count } = await prisma.file.deleteMany({ where: { id, userId } });
  return count > 0;
}

function pathsInFolders(folderIds, userId) {
  return prisma.file.findMany({
    where: { userId, folderId: { in: folderIds } },
    select: { path: true },
  });
}

module.exports = {
  createFile, listInFolder, findByIdAndUser, renameFile, deleteFile, pathsInFolders,
};