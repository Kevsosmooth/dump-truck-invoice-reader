# Deployment Guide

This guide covers deploying the Invoice Processor application using:
- **Vercel** for the React frontend
- **Render** for the Node.js backend
- **Supabase** for PostgreSQL database

## Prerequisites

1. Accounts on:
   - [Vercel](https://vercel.com)
   - [Render](https://render.com)
   - [Supabase](https://supabase.com)
   - [Azure](https://azure.microsoft.com) (for Document AI and Storage)

2. Your code pushed to GitHub

## Step 1: Database Setup (Supabase) ✅ COMPLETED

Your Supabase database is already set up with:
- **Project URL**: `https://tnbplzwfumvyqyedtrdf.supabase.co`
- **Database**: All tables migrated and ready
- **Connection strings** are in your `.env` file

### Your Supabase Connection Details:
```
# Pooled connection (for your app):
DATABASE_URL="postgresql://postgres.tnbplzwfumvyqyedtrdf:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection (for migrations):
DIRECT_URL="postgresql://postgres.tnbplzwfumvyqyedtrdf:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

**Note**: Replace `[YOUR-PASSWORD]` with your actual Supabase database password from the dashboard.

## Step 2: Backend Deployment (Render)

1. **Create a new Web Service on Render**
   - Connect your GitHub repository
   - Choose the `server` directory as root

2. **Configure build settings**
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm start`
   - Environment: Node
   - Region: Choose closest to your users
   - Branch: main

3. **Add environment variables**
   Click "Environment" tab and add these variables:

   **Database (Supabase)**:
   ```
   DATABASE_URL=postgresql://postgres.tnbplzwfumvyqyedtrdf:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

   **Server Config**:
   ```
   PORT=3003
   NODE_ENV=production
   CLIENT_URL=https://your-app.vercel.app
   ```

   **Azure Services** (from your .env):
   ```
   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://silvi.cognitiveservices.azure.com/
   AZURE_DOCUMENT_INTELLIGENCE_KEY=[Your Azure Key]
   AZURE_CUSTOM_MODEL_ID=Silvi_Reader_Full_2.0
   AZURE_STORAGE_ACCOUNT_NAME=dumptruckinvoicereader
   AZURE_STORAGE_ACCOUNT_KEY=[Your Storage Key]
   AZURE_STORAGE_CONTAINER_NAME=documents
   ```

   **Authentication**:
   ```
   JWT_SECRET=[Generate a secure random string]
   SESSION_SECRET=[Generate another secure random string]
   GOOGLE_CLIENT_ID=[Your Google OAuth Client ID]
   GOOGLE_CLIENT_SECRET=[Your Google OAuth Secret]
   GOOGLE_CALLBACK_URL=https://your-backend.onrender.com/auth/google/callback
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note your URL: `https://your-app.onrender.com`

## Step 3: Frontend Deployment (Vercel)

1. **Import project to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Select `client` as the root directory

2. **Configure build settings**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Add environment variable**
   ```
   VITE_API_URL=https://your-app.onrender.com
   ```

4. **Update vercel.json**
   Edit `client/vercel.json` and replace the API URL:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-app.onrender.com/api/:path*"
       },
       {
         "source": "/auth/:path*",
         "destination": "https://your-app.onrender.com/auth/:path*"
       }
     ]
   }
   ```

5. **Deploy**
   - Click "Deploy"
   - Note your URL: `https://your-app.vercel.app`

## Step 4: Update Backend CORS

1. **Go back to Render**
2. **Add your Vercel URL to environment variables**
   ```
   CLIENT_URL=https://your-app.vercel.app
   ```
3. **Redeploy** the Render service

## Step 5: Configure Google OAuth (Optional)

1. **Update Google Cloud Console**
   - Add authorized redirect URI: `https://your-app.onrender.com/auth/google/callback`
   - Add authorized JavaScript origin: `https://your-app.vercel.app`

2. **Update Render environment**
   ```
   GOOGLE_CALLBACK_URL=https://your-app.onrender.com/auth/google/callback
   ```

## Step 6: Test Your Deployment

1. **Visit your frontend URL**
   - `https://your-app.vercel.app`

2. **Test authentication**
   - Try registering a new account
   - Try logging in

3. **Test file upload**
   - Upload a PDF
   - Check if it processes correctly

## Troubleshooting

### CORS Issues
- Make sure `CLIENT_URL` in Render matches your Vercel URL exactly
- Check that cookies are being set with `sameSite: 'none'` and `secure: true`

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Check Supabase connection pooling settings
- Ensure migrations have run successfully

### Authentication Issues
- Verify JWT_SECRET is the same in backend
- Check browser console for cookie warnings
- Ensure frontend is using Authorization headers

### File Upload Issues
- Verify Azure Storage credentials are correct
- Check container exists and has proper permissions
- Monitor Render logs for errors

## Custom Domain Setup

### Frontend (Vercel)
1. Go to project settings > Domains
2. Add your domain
3. Update DNS records as instructed

### Backend (Render)
1. Go to service settings > Custom Domains
2. Add your API subdomain (e.g., `api.yourdomain.com`)
3. Update DNS records

### Update Environment Variables
After setting custom domains, update:
- `CLIENT_URL` in Render
- `VITE_API_URL` in Vercel
- `GOOGLE_CALLBACK_URL` if using OAuth

## Security Checklist

- [ ] Generate strong, unique secrets for JWT_SECRET and SESSION_SECRET
- [ ] Enable HTTPS on both frontend and backend
- [ ] Set up proper CORS origins
- [ ] Use environment variables, never commit secrets
- [ ] Enable rate limiting on Render
- [ ] Set up monitoring and alerts
- [ ] Regular security updates

## Monitoring

1. **Render Dashboard**
   - Monitor service metrics
   - Set up alerts for failures
   - Check logs regularly

2. **Vercel Analytics**
   - Enable Web Analytics
   - Monitor performance metrics

3. **Supabase Dashboard**
   - Monitor database performance
   - Set up connection pooling
   - Regular backups

## Scaling Considerations

- **Render**: Upgrade to paid plan for:
  - More memory/CPU
  - Auto-scaling
  - Zero downtime deploys

- **Vercel**: Generally handles scaling automatically

- **Supabase**: Monitor for:
  - Connection limits
  - Storage usage
  - Query performance