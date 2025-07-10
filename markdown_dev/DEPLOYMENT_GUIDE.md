# Deployment Guide - Dump Truck Invoice Reader

This guide provides comprehensive instructions for deploying the Dump Truck Invoice Reader application to production using Vercel (frontend), Render (backend), and Supabase (PostgreSQL database).

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Database Setup (Supabase)](#database-setup-supabase)
4. [Backend Deployment (Render)](#backend-deployment-render)
5. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Post-Deployment Configuration](#post-deployment-configuration)
8. [Testing & Verification](#testing--verification)
9. [Troubleshooting](#troubleshooting)
10. [Cost Optimization](#cost-optimization)

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Vercel         │────▶│  Render         │────▶│  Supabase       │
│  (Frontend)     │     │  (Backend API)  │     │  (PostgreSQL)   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Azure Blob     │     │  Azure Document │
│  Storage        │     │  Intelligence   │
└─────────────────┘     └─────────────────┘
```

## Prerequisites

- GitHub account with your project repository
- Azure account with:
  - Document Intelligence (Form Recognizer) resource created
  - Storage Account with blob container created
- Google Cloud Console project (for OAuth)
- Accounts on:
  - [Supabase](https://supabase.com)
  - [Render](https://render.com)
  - [Vercel](https://vercel.com)

## Database Setup (Supabase)

### 1. Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - Organization: Select or create one
   - Project Name: `dump-truck-invoice-reader`
   - Database Password: Generate a strong password (save this!)
   - Region: Choose closest to your users
   - Pricing Plan: Free tier is fine to start

### 2. Get Database Connection String

1. In Supabase dashboard, go to Settings → Database
2. Find "Connection string" section
3. Copy the "URI" connection string
4. Replace `[YOUR-PASSWORD]` with your database password
5. Your connection string should look like:
   ```
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

### 3. Enable Connection Pooling

1. In Database settings, ensure "Connection Pooling" is enabled
2. Use the "Transaction" pooling mode
3. Note the pooled connection string (port 6543)

### 4. Run Database Migrations

From your local development environment:

```bash
# In the server directory
cd server

# Update .env with Supabase connection string
DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate deploy
```

## Backend Deployment (Render)

### 1. Prepare Your Repository

Ensure your repository has:
- `server/package.json` with start script
- `server/prisma/schema.prisma`
- No sensitive data committed (.env files should be in .gitignore)

### 2. Create New Web Service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure service:
   - **Name**: `dump-truck-api`
   - **Region**: Same as Supabase if possible
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: 
     ```bash
     npm install && npm run prisma:generate
     ```
   - **Start Command**: 
     ```bash
     npm start
     ```
   - **Instance Type**: Free (can upgrade later)

### 3. Configure Environment Variables

Add all required environment variables in Render dashboard:

```bash
# Database
DATABASE_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-key-here
AZURE_CUSTOM_MODEL_ID=Silvi_Reader_Full_2.0

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=yourstorageaccount
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
AZURE_STORAGE_CONTAINER_NAME=documents

# Authentication
SESSION_SECRET=generate-random-32-char-string
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=generate-another-random-32-char-string

# App Config
NODE_ENV=production
PORT=10000
CLIENT_URL=https://your-app.vercel.app

# Rate Limiting
AZURE_RATE_LIMIT=15
AZURE_BURST_LIMIT=20
```

### 4. Deploy

Click "Create Web Service" and wait for the initial deployment to complete.

## Frontend Deployment (Vercel)

### 1. Prepare Build Configuration

Create `vercel.json` in the client directory:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3. Configure Environment Variables

Add in Vercel dashboard:

```bash
VITE_API_URL=https://dump-truck-api.onrender.com
```

### 4. Deploy

Click "Deploy" and wait for the build to complete.

### 5. Configure Custom Domain (Optional)

1. In Vercel dashboard, go to Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. SSL is automatically provisioned

## Environment Variables Reference

### Backend (.env)

```bash
# Database (Required)
DATABASE_URL=postgresql://connection-string-from-supabase

# Azure Services (Required)
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-api-key
AZURE_CUSTOM_MODEL_ID=Silvi_Reader_Full_2.0
AZURE_STORAGE_ACCOUNT_NAME=yourstorageaccount
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
AZURE_STORAGE_CONTAINER_NAME=documents

# Authentication (Required)
SESSION_SECRET=random-32-character-string
GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
JWT_SECRET=another-random-32-character-string

# URLs (Required)
CLIENT_URL=https://your-frontend.vercel.app

# Server Config
NODE_ENV=production
PORT=10000

# Optional Performance Tuning
AZURE_RATE_LIMIT=15
AZURE_BURST_LIMIT=20
POLLING_INTERVAL=2000
MAX_CONCURRENT=10
```

### Frontend (.env.production)

```bash
VITE_API_URL=https://your-backend.onrender.com
```

## Post-Deployment Configuration

### 1. Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to APIs & Services → Credentials
3. Edit your OAuth 2.0 Client ID
4. Add authorized redirect URIs:
   - `https://your-backend.onrender.com/auth/google/callback`
   - `https://your-frontend.vercel.app/auth/callback`

### 2. Configure CORS

Ensure your backend CORS configuration includes your production frontend URL:

```javascript
app.use(cors({
  origin: process.env.CLIENT_URL || 'https://your-frontend.vercel.app',
  credentials: true,
}));
```

### 3. Set Up Database Indexes

Connect to your Supabase database and run:

```sql
-- Optimize session queries
CREATE INDEX idx_sessions_user_created ON "ProcessingSession"("userId", "createdAt" DESC);
CREATE INDEX idx_sessions_status ON "ProcessingSession"("status");

-- Optimize job queries
CREATE INDEX idx_jobs_session ON "Job"("sessionId");
CREATE INDEX idx_jobs_user_created ON "Job"("userId", "createdAt" DESC);
```

## Testing & Verification

### 1. Health Check

```bash
# Check backend health
curl https://your-backend.onrender.com/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Authentication Flow

1. Navigate to your frontend URL
2. Click "Continue with Google"
3. Complete OAuth flow
4. Verify redirect back to app with user logged in

### 3. Document Processing

1. Upload a test PDF
2. Verify:
   - File uploads to Azure Blob Storage
   - Processing starts
   - Results are returned
   - Download functionality works

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to database"
- Verify DATABASE_URL includes `?pgbouncer=true`
- Check Supabase connection pooling is enabled
- Ensure using pooled connection string (port 6543)

#### 2. CORS Errors
- Verify CLIENT_URL environment variable matches your frontend
- Check backend CORS configuration
- Ensure credentials: true in CORS settings

#### 3. OAuth Redirect Mismatch
- Double-check redirect URIs in Google Console
- Ensure they match exactly (including https://)
- Clear browser cookies and try again

#### 4. File Upload Failures
- Verify Azure Storage credentials
- Check container exists and has proper access
- Ensure AZURE_STORAGE_CONTAINER_NAME is correct

#### 5. Slow Cold Starts (Render Free Tier)
- Expected behavior on free tier
- Consider upgrading to paid instance ($7/month)
- Implement a keep-alive ping if needed

### Debug Commands

```bash
# Check Render logs
# Go to Render dashboard → Your Service → Logs

# Test database connection locally
DATABASE_URL=your-prod-connection-string npm run prisma:studio

# Verify Azure credentials
# Use Azure Storage Explorer to test connection
```

## Cost Optimization

### Estimated Monthly Costs

- **Supabase Free Tier**: $0
  - 500MB database
  - 2GB bandwidth
  - 50,000 requests

- **Render Free Tier**: $0
  - 750 hours/month
  - Spins down after 15 min inactivity

- **Vercel Free Tier**: $0
  - 100GB bandwidth
  - Unlimited deployments

- **Azure Services**: Pay-per-use
  - Document Intelligence: $1.50 per 1000 pages
  - Blob Storage: ~$0.02/GB stored + minimal transaction costs

### Cost Saving Tips

1. **Implement Caching**
   - Cache processed results in database
   - Reuse extracted data when possible

2. **Optimize Azure Usage**
   - Delete processed blobs after 24 hours
   - Use lifecycle policies for automatic cleanup

3. **Monitor Usage**
   - Set up Azure cost alerts
   - Track API usage in your app
   - Implement user quotas

4. **Scale Gradually**
   - Start with free tiers
   - Upgrade only when hitting limits
   - Consider Render's $7/month starter plan for better performance

## Production Checklist

- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] Google OAuth redirect URIs updated
- [ ] CORS properly configured
- [ ] SSL certificates active (automatic with Vercel/Render)
- [ ] Error tracking configured (consider Sentry)
- [ ] Backup strategy in place
- [ ] Monitoring set up (Render provides basic metrics)
- [ ] Rate limiting configured
- [ ] Security headers implemented
- [ ] Robots.txt configured if needed
- [ ] Privacy policy and terms of service pages

## Alternative Deployment Options

### Railway (All-in-One)

If you prefer a single platform:

1. [Railway.app](https://railway.app) can host:
   - PostgreSQL database
   - Node.js backend
   - Static frontend
2. Simpler deployment but less free tier resources
3. Good for MVP/testing

### Self-Hosted Options

For more control:
- **Database**: PostgreSQL on DigitalOcean/AWS RDS
- **Backend**: Docker container on AWS ECS/Google Cloud Run
- **Frontend**: AWS S3 + CloudFront

## Support & Maintenance

### Regular Tasks

1. **Weekly**
   - Check error logs
   - Monitor Azure usage
   - Review user feedback

2. **Monthly**
   - Update dependencies
   - Check for security patches
   - Review costs

3. **Quarterly**
   - Performance optimization
   - Feature planning
   - User analytics review

### Backup Strategy

1. **Database Backups**
   - Supabase provides daily backups (7 days on free tier)
   - Consider manual exports for critical data

2. **Code Backups**
   - GitHub repository
   - Tag releases for easy rollback

3. **Document Storage**
   - Azure Blob Storage has redundancy
   - Consider implementing soft deletes

## Conclusion

Your application should now be fully deployed and accessible to users. Remember to:
- Monitor logs during the first few days
- Gather user feedback
- Plan for scaling based on usage patterns

For questions or issues, refer to:
- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Azure Documentation](https://docs.microsoft.com/azure)