require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDb = require('./config/db');
const authRoutes = require('./routes/auth');

const app = express();
const port = process.env.PORT || 5000;

// Connect database
connectDb();

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});