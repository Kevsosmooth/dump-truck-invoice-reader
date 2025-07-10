import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';
import './config/passport.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Initialize Prisma
export const prisma = new PrismaClient();

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      // Add your Vercel domains here
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
      process.env.PRODUCTION_URL,
    ].filter(Boolean); // Remove any undefined values
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
import jobRoutes from './routes/jobs.js';
import userRoutes from './routes/user.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import modelTrainingRoutes from './routes/model-training.js';
import modelsRoutes from './routes/models.js';
import sessionRoutes from './routes/sessions.js';
import devRoutes from './routes/dev.js';

app.use('/api/jobs', jobRoutes);
app.use('/api/user', userRoutes);
app.use('/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/model-training', modelTrainingRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/sessions', sessionRoutes);

// Development routes (only in dev mode)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500,
    },
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log('📦 Running without Redis/Bull queues - Jobs will be processed synchronously');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Server shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});