import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
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
import jobRoutesSimple from './routes/jobs-simple';
app.use('/api/jobs', jobRoutesSimple);

// Simple user credits endpoint
app.get('/api/user/credits', (req, res) => {
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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500,
    },
  });
});

// Start server - SIMPLE VERSION
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📦 Running in SIMPLE MODE - No database required!');
  console.log('🔑 Azure endpoint:', process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || 'NOT SET');
  console.log('🤖 Custom model:', process.env.AZURE_CUSTOM_MODEL_ID || 'NOT SET');
  console.log('\n✅ You can now upload invoices without setting up PostgreSQL or Redis!');
});