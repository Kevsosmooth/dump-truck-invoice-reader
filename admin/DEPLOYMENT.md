# Admin Dashboard Deployment Guide

## Prerequisites
- Vercel account
- Backend API already deployed (server must be running)
- Supabase database configured

## Environment Variables for Vercel

Add these environment variables in your Vercel project settings:

```
VITE_API_URL=https://your-backend-api.com
```

Replace `your-backend-api.com` with your actual backend API URL.

## Deployment Steps

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy from the admin directory:
```bash
cd admin
vercel
```

3. Follow the prompts:
   - Set up and deploy: Yes
   - Which scope: Your account
   - Link to existing project: No (first time) / Yes (updates)
   - Project name: dump-truck-admin
   - Directory: ./
   - Override build settings: No

### Option 2: Deploy via GitHub

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Select the `admin` directory as the root directory
6. Add environment variables:
   - `VITE_API_URL`: Your backend API URL
7. Click "Deploy"

## Post-Deployment Setup

1. **Update CORS in Backend**
   Add your Vercel domain to the allowed origins in your backend:
   ```javascript
   // server/src/index.js
   const allowedOrigins = [
     'https://your-admin-app.vercel.app',
     // ... other origins
   ];
   ```

2. **Update Google OAuth Redirect**
   Add your admin dashboard URL to Google OAuth authorized redirect URIs:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select your project
   - Go to APIs & Services > Credentials
   - Edit your OAuth 2.0 Client
   - Add: `https://your-admin-app.vercel.app/auth/callback`

3. **Test Authentication**
   - Visit your deployed admin dashboard
   - Try logging in with Google OAuth
   - Verify admin role is required

## Important Security Notes

1. **Admin Role Check**: The dashboard checks for `role: 'ADMIN'` in the user table
2. **Separate Authentication**: Admin uses `adminToken` cookie, not the regular `token`
3. **API Protection**: All `/api/admin/*` routes require admin authentication

## Troubleshooting

### CORS Issues
If you see CORS errors:
1. Ensure your Vercel domain is in the backend's allowed origins
2. Restart your backend server after updating CORS settings

### Authentication Issues
If login fails:
1. Check that your user has `role: 'ADMIN'` in the database
2. Verify the backend API URL is correct
3. Check browser console for specific errors

### API Connection Issues
If API calls fail:
1. Ensure VITE_API_URL doesn't have a trailing slash
2. Verify your backend is deployed and accessible
3. Check that all required environment variables are set

## Monitoring

Monitor your deployment:
- Vercel Dashboard: Check build logs and function logs
- Browser DevTools: Check network tab for API errors
- Backend Logs: Monitor for authentication attempts