const prisma = require('./prisma');

async function connectToDB() {
  try {
    await prisma.$queryRaw`select 1`;
    console.log('Connected to DB');
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { connectToDB };