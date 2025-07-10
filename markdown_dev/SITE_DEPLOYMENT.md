# Site Deployment Configuration

This document outlines all the changes made to prepare the Invoice Processor application for deployment using Vercel (frontend), Render (backend), and Supabase (database).

## Changes Made for Deployment

### 1. Frontend Configuration Changes

#### Created `/client/src/config/api.js`
- Centralized API configuration file
- Uses environment variable `VITE_API_URL` with fallback to localhost
- Exports `API_ENDPOINTS` object with all API routes
- Includes `fetchWithAuth` utility function that automatically adds JWT tokens
- Helper function `isProduction()` to detect environment

#### Updated All API Calls in Frontend
- Modified `/client/src/contexts/AuthContext.jsx`:
  - Replaced hardcoded URLs with `API_ENDPOINTS`
  - Updated all fetch calls to use `fetchWithAuth`
  - Removed manual Authorization headers (handled by fetchWithAuth)

- Modified `/client/src/pages/Login.jsx`:
  - Imported `API_ENDPOINTS` and `fetchWithAuth`
  - Updated login/register endpoints
  - Updated Google OAuth redirect

- Modified `/client/src/App.jsx`:
  - Imported `API_URL` and `fetchWithAuth`
  - Updated all 7 fetch calls to use centralized config
  - Fixed missing auth context in `JobItemWithDownload` component

#### Created `/client/vercel.json`
- Configured Vite framework settings
- Added rewrites to proxy `/api/*` and `/auth/*` routes to backend
- Added security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Configured environment variable mapping

#### Created `/client/.env.example`
- Template for frontend environment variables
- Documents `VITE_API_URL` configuration

### 2. Backend Configuration Changes

#### Updated `/server/src/index.js`
- Enhanced CORS configuration to support multiple origins dynamically
- Added function to validate allowed origins
- Supports environment variables:
  - `CLIENT_URL` - Primary frontend URL
  - `VERCEL_URL` - Vercel preview URLs
  - `PRODUCTION_URL` - Custom domain
- Added proper CORS headers and methods
- Improved error handling for CORS violations

#### Updated `/server/src/routes/auth.js`
- Modified cookie settings for cross-origin compatibility:
  - `sameSite: 'none'` in production (required for cross-origin)
  - `sameSite: 'lax'` in development
  - `secure: true` in production (HTTPS only)
  - Added optional `domain` support for subdomain sharing

### 3. Deployment Configuration Files

#### Created `/server/render.yaml`
- Render deployment configuration
- Specifies build and start commands
- Defines all required environment variables
- Includes Prisma migration in build step
- Sets health check endpoint

#### Created `/server/.env.production.example`
- Complete production environment template
- Documents all required variables for Render
- Includes optional services (Stripe, SendGrid)
- Provides guidance on secure secret generation

### 4. Documentation

#### Created `/DEPLOYMENT.md`
- Comprehensive deployment guide with step-by-step instructions
- Covers:
  - Supabase database setup and migrations
  - Render backend deployment process
  - Vercel frontend deployment process
  - CORS configuration updates
  - Google OAuth setup
  - Testing procedures
  - Troubleshooting common issues
  - Custom domain setup
  - Security checklist
  - Monitoring recommendations
  - Scaling considerations

### 5. MCP Configuration

#### Updated `/.mcp.json`
- Added Supabase MCP server configuration
- Configured with project-ref: `tnbplzwfumvyqyedtrdf`
- Includes personal access token
- Set to read-only mode for safety

## Key Architecture Decisions

### Authentication Strategy
- Primary: JWT tokens stored in localStorage with Authorization headers
- Fallback: HTTP-only cookies configured for cross-origin
- This dual approach ensures compatibility across all platforms, especially mobile

### CORS Configuration
- Dynamic origin validation instead of wildcards
- Supports multiple deployment environments
- Proper preflight handling for complex requests

### API Proxy Strategy
- Vercel rewrites make API appear same-origin
- Eliminates CORS issues for browsers with strict policies
- Maintains clean URL structure

### Environment Variable Management
- Clear separation between development and production
- Sensitive values never committed to repository
- Environment-specific configuration files

## Security Improvements

1. **JWT Tokens**: Used for stateless authentication
2. **Secure Cookies**: HTTPS-only with proper SameSite attributes
3. **CORS**: Strict origin validation
4. **Headers**: Security headers added via Vercel
5. **Secrets**: Strong random values required for production

## Benefits of This Configuration

1. **Cross-Platform Compatibility**: Works on web and mobile without cookie issues
2. **Development Experience**: Easy local development with production parity
3. **Scalability**: Stateless backend can scale horizontally
4. **Security**: Multiple layers of security implemented
5. **Flexibility**: Easy to add custom domains or change providers

## Next Steps for Deployment

1. Commit all changes to Git
2. Push to GitHub repository
3. Create accounts on Vercel, Render, and Supabase
4. Follow the step-by-step guide in `/DEPLOYMENT.md`
5. Configure environment variables in each service
6. Deploy and test

## Files Modified/Created Summary

### Created Files:
- `/client/src/config/api.js`
- `/client/vercel.json`
- `/client/.env.example`
- `/server/render.yaml`
- `/server/.env.production.example`
- `/DEPLOYMENT.md`
- `/markdown_dev/SITE_DEPLOYMENT.md` (this file)

### Modified Files:
- `/client/src/contexts/AuthContext.jsx`
- `/client/src/pages/Login.jsx`
- `/client/src/App.jsx`
- `/server/src/index.js`
- `/server/src/routes/auth.js`
- `/.mcp.json`

All changes maintain backward compatibility while enabling modern cloud deployment.