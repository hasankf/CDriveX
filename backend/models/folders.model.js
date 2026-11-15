const prisma = require('../config/prisma');

const publicFolder = { id: true, name: true, createdAt: true };

// purpose: get all folders directly inside a particular folder. it takes USERID and PARENTID as parameter.
// only lists direct children, not any further

function listChildren(userId, parentId) {
  return prisma.folder.findMany({
    where: { userId, parentId }, // if parentid is null then only ROOT level folders are returned
    select: publicFolder, // returns FOLDERID FOLDERNAME CREATEDDATE
    orderBy: { name: 'asc' },
  });
}

// Purpose: Find a folder only if it belongs to the requesting user.

function findOwned(id, userId) {
  return prisma.folder.findFirst({ where: { id, userId }, select: { id: true, name: true } });
}

//Purpose: Create a new folder.
// if we create a root folder its parentid == null
function createFolder({ name, parentId, userId }) {
  return prisma.folder.create({ 
    data: { name, parentId, userId }, 
    select: publicFolder 
  });
}

// Path from the top level down to this folder, e.g. [Work, Reports, 2026]
// RECURSIVE allows the query to repeatedly follow relationships until it reaches the top-level folder

function breadcrumbs(id, userId) {
  return prisma.$queryRaw`
    WITH RECURSIVE up AS (
      SELECT id, name, parent_id, 0 AS depth
      FROM folders WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
      UNION ALL
      SELECT f.id, f.name, f.parent_id, up.depth + 1
      FROM folders f JOIN up ON f.id = up.parent_id
    )
    SELECT id, name FROM up ORDER BY depth DESC`;
}

// find current folder plus every folder inside it, at any depth
async function subtreeIds(id, userId) {
  const rows = await prisma.$queryRaw`
    WITH RECURSIVE tree AS (
      SELECT id FROM folders WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
      UNION ALL
      SELECT f.id FROM folders f JOIN tree t ON f.parent_id = t.id
    )
    SELECT id FROM tree`;
  return rows.map((r) => r.id);
}

async function deleteFolder(id, userId) {
  const { count } = await prisma.folder.deleteMany({ where: { id, userId } });
  return count > 0;
}

module.exports = { listChildren, findOwned, createFolder, breadcrumbs, subtreeIds, deleteFolder };