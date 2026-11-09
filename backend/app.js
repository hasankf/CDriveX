const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const { connectToDB } = require('./config/db');
connectToDB();

const cookieParser = require('cookie-parser');
const apiRouter = require('./routes/api.routes');

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
