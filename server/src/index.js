import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';
import './config/passport.js';

// Load environment variables only in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

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
      'http://localhost:5174', // Admin dashboard
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
app.use(cookieParser());

// Session middleware for OAuth state tracking
app.use(session({
  secret: process.env.SESSION_SECRET || 'admin-dashboard-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60000 // 1 minute - just for OAuth flow
  }
}));

// Apply JSON parser to all routes except multipart uploads
app.use((req, res, next) => {
  // Skip JSON parsing for multipart/form-data routes
  if (req.is('multipart/form-data')) {
    next();
  } else {
    express.json({ limit: '500mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(passport.initialize());

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    name: 'Dump Truck Invoice Reader API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: {
        google: '/auth/google',
        logout: '/auth/logout',
        status: '/auth/status'
      },
      adminAuth: {
        login: '/admin/auth/login',
        logout: '/admin/auth/logout',
        me: '/admin/auth/me'
      },
      api: {
        sessions: '/api/sessions',
        models: '/api/models',
        user: '/api/user',
        jobs: '/api/jobs',
        admin: '/api/admin/*'
      }
    },
    documentation: 'https://github.com/Kevsosmooth/dump-truck-invoice-reader'
  });
});

// Health check endpoint with more details
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Routes
import jobRoutes from './routes/jobs.js';
import userRoutes from './routes/user.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import adminAuthRoutes from './routes/admin-auth.js';
import adminAnalyticsRoutes from './routes/admin-analytics.js';
import modelTrainingRoutes from './routes/model-training.js';
import modelsRoutes from './routes/models.js';
import sessionRoutes from './routes/sessions.js';
import devRoutes from './routes/dev.js';
import tierInfoRoutes from './routes/tier-info.js';

app.use('/api/jobs', jobRoutes);
app.use('/api/user', userRoutes);
app.use('/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/admin/auth', adminAuthRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/model-training', modelTrainingRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/sessions', sessionRoutes);

// Development routes (only in dev mode)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
  app.use('/api/tier-info', tierInfoRoutes);
  
  // Development admin routes
  const devAdminRoutes = (await import('./routes/dev-admin.js')).default;
  app.use('/api/dev/admin', devAdminRoutes);
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
    
    // Import session cleanup manager
    const sessionCleanupManager = (await import('./services/session-cleanup-manager.js')).default;
    
    // Reschedule cleanups for all existing sessions
    console.log('🔄 Rescheduling cleanups for existing sessions...');
    await sessionCleanupManager.rescheduleAllSessions();
    console.log('✅ Session cleanups rescheduled');
    
    // Initialize cleanup scheduler for expired sessions (as a fallback)
    if (process.env.ENABLE_AUTO_CLEANUP !== 'false') {
      const { scheduleCleanup } = await import('./services/cleanup-service.js');
      // Run cleanup daily at 2 AM
      scheduleCleanup('0 2 * * *');
      console.log('✅ Cleanup scheduler initialized (runs daily at 2 AM as fallback for expired sessions)');
    }

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
  
  // Clear all scheduled cleanups
  try {
    const sessionCleanupManager = (await import('./services/session-cleanup-manager.js')).default;
    sessionCleanupManager.clearAllCleanups();
    console.log('✅ Cleared all scheduled cleanups');
  } catch (error) {
    console.error('❌ Error clearing scheduled cleanups:', error);
  }
  
  await prisma.$disconnect();
  process.exit(0);
});