require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const connectDb = require('./config/db');
const { redis } = require('./config/redis');
const { initSocket } = require('./sockets/marketSocket');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const marketRoutes = require('./routes/market');
const stockRoutes = require('./routes/stocks');
const watchlistRoutes = require('./routes/watchlist');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason?.message || reason);
});

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

connectDb();
initSocket(server);

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      process.env.CLIENT_ORIGIN,
    ].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/watchlist', watchlistRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', websocket: 'enabled', redis: redis.status });
});

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log(`WebSocket server is ready for connections`);
});
