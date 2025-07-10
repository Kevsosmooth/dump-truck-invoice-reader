# Supabase Setup Instructions

## Database Migration Complete! ✅

All tables from your Prisma schema have been successfully created in Supabase.

## Connection Details

**Project URL:** `https://tnbplzwfumvyqyedtrdf.supabase.co`  
**Project Reference:** `tnbplzwfumvyqyedtrdf`  
**Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuYnBsendmdW12eXF5ZWR0cmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjcxNjUsImV4cCI6MjA2Nzc0MzE2NX0.cXM-LGn8mQ3NAVUTB7lL1LcBGsPPW5T7_4j1cIzn774`

## Next Steps

### 1. Get Your Database Password

1. Go to your Supabase dashboard: https://app.supabase.com/project/tnbplzwfumvyqyedtrdf
2. Navigate to Settings → Database
3. Copy your database password

### 2. Update Your Environment Variables

1. Copy `.env.supabase` to `.env`:
   ```bash
   cp .env.supabase .env
   ```

2. Replace the placeholders in your `.env` file:
   - Replace `[YOUR-PASSWORD]` with your Supabase database password
   - Replace `[YOUR-PROJECT-REF]` with `tnbplzwfumvyqyedtrdf`
   - Replace `[YOUR-ANON-KEY]` with the anon key above

Your final DATABASE_URL should look like:
```
DATABASE_URL="postgresql://postgres.tnbplzwfumvyqyedtrdf:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

### 3. Update Prisma Configuration

The Prisma schema is already configured to use the DATABASE_URL environment variable, so no changes needed there.

### 4. Test the Connection

```bash
cd server
npx prisma db pull
```

This should successfully introspect your Supabase database and show all the tables we created.

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Run the Application

```bash
npm run dev
```

## Tables Created

✅ User - User accounts with authentication  
✅ Session - JWT session management  
✅ Organization - User organizations  
✅ CustomModel - Azure custom models  
✅ ProcessingSession - Document processing sessions  
✅ Job - Individual document processing jobs  
✅ Transaction - Credit transactions  
✅ AuditLog - Audit trail  
✅ FileAccessLog - File access tracking  
✅ CleanupLog - Cleanup job history  

All foreign key relationships, indexes, and triggers have been properly set up.

## Supabase Authentication (Optional)

If you want to use Supabase Auth instead of your current JWT implementation:

1. Enable Authentication in Supabase dashboard
2. Configure Google OAuth provider in Supabase
3. Update your backend to use Supabase Auth SDK

## Row Level Security (RLS)

RLS is enabled on all tables but policies need to be configured based on your authentication method. Once you set up Supabase Auth, we can add proper RLS policies.

## Troubleshooting

1. **Connection refused**: Make sure you're using the correct password and connection string
2. **SSL required**: The connection strings above include SSL by default
3. **Permission denied**: Check that RLS policies are properly configured or temporarily disable RLS for testing