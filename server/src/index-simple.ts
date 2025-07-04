import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow all origins temporarily
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Routes - Simple version without database
import jobRoutesSimple from './routes/jobs-simple-new';
import modelTrainingRoutes from './routes/model-training';

app.use('/api/jobs', jobRoutesSimple);
app.use('/api/models', modelTrainingRoutes);

// Simple user credits endpoint
app.get('/api/user/credits', (_req, res) => {
  res.json({
    balance: 100,
    usage: {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
    }
  });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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
}).on('error', (err: any) => {
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