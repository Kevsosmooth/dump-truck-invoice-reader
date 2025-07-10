# Deployment Checklist

## ✅ Completed
- [x] Supabase database created and migrated
- [x] All tables, indexes, and relationships set up
- [x] Connection strings configured in .env
- [x] Frontend API configuration centralized
- [x] CORS configuration prepared
- [x] Deployment files created (render.yaml, vercel.json)

## 📋 Next Steps

### 1. Deploy Backend to Render
- [ ] Go to [render.com](https://render.com)
- [ ] Create new Web Service
- [ ] Connect GitHub repo
- [ ] Set root directory to `server`
- [ ] Configure environment variables:
  - [ ] DATABASE_URL (with your Supabase password)
  - [ ] Azure credentials
  - [ ] JWT secrets (generate new ones!)
  - [ ] Google OAuth credentials
- [ ] Deploy and get your backend URL

### 2. Deploy Frontend to Vercel
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Import GitHub repository
- [ ] Set root directory to `client`
- [ ] Add environment variable:
  ```
  VITE_API_URL=https://your-backend.onrender.com
  ```
- [ ] Deploy and get your frontend URL

### 3. Update Backend CORS
- [ ] Go back to Render
- [ ] Update CLIENT_URL to your Vercel URL
- [ ] Redeploy

### 4. Configure Google OAuth
- [ ] Update Google Cloud Console with production URLs
- [ ] Add Render callback URL
- [ ] Add Vercel as authorized origin

### 5. Test Everything
- [ ] Test login/register
- [ ] Test Google OAuth
- [ ] Test file upload
- [ ] Test PDF processing
- [ ] Test download

## 🔑 Important Reminders

1. **Generate new secrets for production!**
   ```bash
   # Generate secure secrets
   openssl rand -base64 32
   ```

2. **Use your actual Azure keys** from your .env file

3. **Replace placeholders**:
   - `[YOUR-PASSWORD]` → Your Supabase password
   - `[Your Azure Key]` → Your actual Azure keys
   - `https://your-app.vercel.app` → Your actual Vercel URL
   - `https://your-backend.onrender.com` → Your actual Render URL

4. **Test locally first** to ensure everything works

## 🚀 Ready to Deploy?

1. Make sure all changes are committed and pushed
2. Have your Azure keys ready
3. Have your Google OAuth credentials ready
4. Follow the deployment guide step by step

Good luck with your deployment! 🎉