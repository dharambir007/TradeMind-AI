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
const aiInsightRoutes = require('./routes/aiInsight');
const predictionRoutes = require('./routes/prediction');

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error?.stack || error?.message || error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason?.message || reason);
});

const app = express();
const server = http.createServer(app);
const basePort = Number(process.env.PORT) || 5000;
const maxPortAttempts = Number(process.env.PORT_RETRY_ATTEMPTS) || 10;

async function bootstrap() {
  try {
    await connectDb();
  } catch (err) {
    console.error('Failed to initialize MongoDB:', err?.message || err);
    process.exit(1);
  }

  initSocket(server);

  app.use(
    cors({
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'https://trade-mind-ai-umber.vercel.app',
        process.env.CLIENT_ORIGIN,
      ].filter(Boolean),
      credentials: true,
    })
  );
  app.use(express.json());
  app.use((req, res, next) => {
    console.log('API HIT:', req.originalUrl);
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/stocks', stockRoutes);
  app.use('/api/watchlist', watchlistRoutes);
  app.use('/api/ai-insight', aiInsightRoutes);
  app.use('/api/prediction', predictionRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'running' });
  });

  app.get('/', (req, res) => {
    res.json({ status: 'ok', websocket: 'enabled', redis: redis.status });
  });

  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    }
    return next();
  });

  app.use((err, req, res, next) => {
    console.error('Express error:', err?.stack || err?.message || err);
    if (res.headersSent) return next(err);
    return res.status(err?.status || 500).json({
      success: false,
      message: err?.message || 'Internal server error',
    });
  });

  startServer(basePort, maxPortAttempts - 1);
}

function startServer(port, remainingRetries) {
  const onListening = () => {
    server.off('error', onError);
    const activePort = server.address()?.port || port;
    console.log(`Server is running at http://localhost:${activePort}`);
    console.log('WebSocket server is ready for connections');
  };

  const onError = (err) => {
    server.off('listening', onListening);

    if (err?.code === 'EADDRINUSE' && remainingRetries > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Retrying on ${nextPort}...`);

      if (server.listening) {
        server.close(() => startServer(nextPort, remainingRetries - 1));
      } else {
        startServer(nextPort, remainingRetries - 1);
      }
      return;
    }

    console.error('Failed to start server:', err?.message || err);
    process.exit(1);
  };

  server.once('listening', onListening);
  server.once('error', onError);
  server.listen(port, '0.0.0.0');
}

bootstrap();
