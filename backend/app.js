const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const cors = require('cors');
const cookieParser = require('cookie-parser');
const { connectToDB } = require('./config/db');
const apiRouter = require('./routes/api.routes');

connectToDB();

const app = express();

// 1. Configure CORS (Must be before routes)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // Allows sending and receiving HTTP-only cookies cross-domain
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// 2. Define PORT and only listen outside Vercel's serverless environment
const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
