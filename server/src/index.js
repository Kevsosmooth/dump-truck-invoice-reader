import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';
import './config/passport.js';

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  // Check if a custom env file path was provided
  const envFile = process.env.DOTENV_CONFIG_PATH || '.env';
  dotenv.config({ path: envFile });
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
      // Production domains
      'https://dump-truck-invoice-reader-admin.vercel.app', // Admin dashboard
      'https://dump-truck-invoice-reader.vercel.app', // Main client (if deployed)
      // Add your Vercel domains here
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
      process.env.PRODUCTION_URL,
      process.env.ADMIN_URL, // Optional: set this in Render env vars
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
  saveUninitialized: true, // Changed to true to ensure session is saved
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
    maxAge: 5 * 60 * 1000 // 5 minutes - enough for OAuth flow
  }
}));

// Apply raw body parser for Stripe webhook before JSON parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Apply JSON parser to all routes except multipart uploads and webhook
app.use((req, res, next) => {
  // Skip JSON parsing for multipart/form-data routes and webhook
  if (req.is('multipart/form-data') || req.path === '/api/payments/webhook') {
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
        login: '/api/admin/auth/login',
        logout: '/api/admin/auth/logout',
        me: '/api/admin/auth/me'
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
import adminCreditsRoutes from './routes/admin-credits.js';
import adminHealthRoutes from './routes/admin-health.js';
import adminActivityRoutes from './routes/admin-activity.js';
import adminModelsRoutes from './routes/admin/models.js';
import adminPackagesRoutes from './routes/admin-packages.js';
import modelTrainingRoutes from './routes/model-training.js';
import modelsRoutes from './routes/models.js';
import sessionRoutes from './routes/sessions.js';
import devRoutes from './routes/dev.js';
import tierInfoRoutes from './routes/tier-info.js';
import metricsRoutes from './routes/metrics.js';
import paymentRoutes from './routes/payments.js';
import transactionRoutes from './routes/transactions.js';

app.use('/api/jobs', jobRoutes);
app.use('/api/user', userRoutes);
app.use('/auth', authRoutes);
// Mount admin auth routes FIRST (no authentication required)
app.use('/api/admin/auth', adminAuthRoutes);
// Then mount other admin routes (authentication required)
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/credits', adminCreditsRoutes);
app.use('/api/admin/health', adminHealthRoutes);
app.use('/api/admin/activity', adminActivityRoutes);
app.use('/api/admin/models', adminModelsRoutes);
app.use('/api/admin/packages', adminPackagesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/model-training', modelTrainingRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/transactions', transactionRoutes);

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