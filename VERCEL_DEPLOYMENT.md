# Vercel Deployment Guide

## Quick Fix for "VITE_API_URL" Error

You have two options to fix this error:

### Option 1: Use Vercel Rewrites (Recommended)
Your `vercel.json` is already configured to use rewrites. You just need to:

1. Update the rewrite destination URLs in `client/vercel.json`:
   ```json
   "rewrites": [
     {
       "source": "/api/:path*",
       "destination": "https://YOUR-BACKEND.onrender.com/api/:path*"
     },
     {
       "source": "/auth/:path*", 
       "destination": "https://YOUR-BACKEND.onrender.com/auth/:path*"
     }
   ]
   ```

2. Replace `https://your-api.onrender.com` with your actual Render backend URL

3. Redeploy to Vercel

### Option 2: Set Environment Variable in Vercel
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add new variable:
   - Name: `VITE_API_URL`
   - Value: `https://YOUR-BACKEND.onrender.com`
   - Environment: Production, Preview, Development

## How It Works

- **Development**: Uses `http://localhost:3003` automatically
- **Production with rewrites**: Uses relative URLs (`/api/...`) that get proxied to your backend
- **Production with env var**: Uses the URL you set in `VITE_API_URL`

## Current Configuration

Your app is configured to work both ways:
- If `VITE_API_URL` is set, it uses that
- If not set and in production, it uses relative URLs (empty string)
- If not set and in development, it uses `http://localhost:3003`

## CORS Configuration

Make sure your backend (server/src/index.js) allows your Vercel domain:
- Add your Vercel domain to the `allowedOrigins` array
- Example: `https://your-app.vercel.app`