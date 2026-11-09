const prisma = require('../config/prisma');

async function createUser({ username, email, password }) {
  return prisma.user.create({
    data: { username: username.toLowerCase(), email: email.toLowerCase(), password },
    select: { id: true, username: true, email: true },
  });
}

async function findByUsername(username) {
  return prisma.user.findUnique({ where: { username: username.toLowerCase() } });
}

module.exports = { createUser, findByUsername };