import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './config/passport.js';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Frontend URL (Vite default)
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mode: 'simple (no database)',
    azure: {
      endpoint: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ? 'configured' : 'missing',
      model: process.env.AZURE_CUSTOM_MODEL_ID || 'not specified'
    }
  });
});

// Routes
import jobRoutesSimple from './routes/jobs-simple-new.js';
// import modelTrainingRoutes from './routes/model-training.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { authenticateToken } from './middleware/auth.js';

// Public routes
app.use('/auth', authRoutes);

// Protected routes - temporarily removing auth for testing
app.use('/api/jobs', jobRoutesSimple); // TODO: Add back authenticateToken middleware
// app.use('/api/models', authenticateToken, modelTrainingRoutes);
app.use('/api/admin', adminRoutes); // Admin middleware is applied in the route file

// User credits endpoint
app.get('/api/user/credits', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    
    return res.json({
      balance: user?.credits || 0,
      usage: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500,
    },
  });
});

// Start server - SIMPLE VERSION
const PORT = parseInt(process.env.PORT || '3003');

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📦 Running in SIMPLE MODE - No database required!');
  console.log('🔑 Azure endpoint:', process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || 'NOT SET');
  console.log('🤖 Custom model:', process.env.AZURE_CUSTOM_MODEL_ID || 'NOT SET');
  console.log('\n✅ You can now upload invoices without setting up PostgreSQL or Redis!');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`💡 Try one of these solutions:`);
    console.error(`   1. Kill the process using port ${PORT}`);
    console.error(`   2. Set a different port: PORT=3002 npm run dev:simple`);
    console.error(`   3. Check what's using the port: netstat -ano | findstr :${PORT}`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});