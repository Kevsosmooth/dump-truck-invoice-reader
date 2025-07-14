# Database Reset Guide for Windows

This guide helps you fix database migration issues and sync with Supabase.

## Problem Summary

The database migrations are failing because they reference tables in the wrong order. The `20250113_model_management` migration tries to reference the User table before it's created.

## Solution Files Created

1. **reset-database.sql** - Drops all tables and types in the correct order
2. **init-database.sql** - Creates all tables with proper dependencies
3. **reset-db-windows.js** - Node.js script to automate the reset process
4. **export-for-supabase.js** - Generates Supabase-compatible SQL with RLS policies

## Step 1: Reset Your Local Database

### Option A: Using pgAdmin (Manual)

1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Open a Query Tool for the `postgres` database (not your app database)
4. Run these commands:

```sql
-- Terminate connections
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'dump-truck-invoice'
  AND pid <> pg_backend_pid();

-- Drop and recreate database
DROP DATABASE IF EXISTS "dump-truck-invoice";
CREATE DATABASE "dump-truck-invoice";
```

5. Connect to the new `dump-truck-invoice` database
6. Open the file `server/prisma/init-database.sql`
7. Copy all contents and paste into Query Tool
8. Execute the query

### Option B: Using Node.js Script (Automated)

Run this command in your server directory:

```bash
npm run reset:db:windows
```

This will:
- Drop the existing database
- Create a new database
- Run the initialization script
- Create an initial admin user

## Step 2: Generate Prisma Client

After resetting the database:

```bash
npm run prisma:generate
```

## Step 3: Sync with Supabase

### Generate Supabase Migration

```bash
node export-for-supabase.js
```

This creates `prisma/supabase-migration.sql` with:
- All table definitions
- Foreign key constraints
- Row Level Security policies
- Performance indexes
- Automatic credit update triggers

### Apply to Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New query**
4. Copy the contents of `prisma/supabase-migration.sql`
5. Paste into the query editor
6. Click **Run**

### Important Notes for Supabase

1. **Authentication**: The RLS policies assume you're using Supabase Auth. If you're using custom JWT tokens, modify the policies accordingly.

2. **User ID Mapping**: The policies use `auth.uid()` which returns a UUID. You may need to adjust based on your auth setup.

3. **Initial Data**: The migration includes default credit packages. You can modify these in the SQL before running.

## Step 4: Update Environment Variables

Make sure your `.env` files have the correct database URLs:

### Local Development (.env or .env.dev)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dump-truck-invoice"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/dump-truck-invoice"
```

### Production (.env.prod)
```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

## Step 5: Test the Setup

1. Start your server:
   ```bash
   npm run dev
   ```

2. Test the payment endpoints:
   ```bash
   # Get credit packages
   curl http://localhost:3003/api/payments/packages
   ```

3. The Stripe webhook should already be configured:
   ```bash
   npm run stripe:webhook
   ```

## Troubleshooting

### "relation does not exist" errors
- Make sure you ran the reset process completely
- Check that Prisma client was regenerated

### Cannot connect to database
- Verify PostgreSQL is running
- Check your DATABASE_URL in .env
- Ensure the database name matches

### Supabase migration fails
- Check for existing tables (drop them first if needed)
- Verify you're running in the correct project
- Review error messages for constraint violations

## Next Steps

1. Test the Purchase Credits flow in your application
2. Verify webhook handling with Stripe CLI
3. Check that credits are properly updated after purchases
4. Review audit logs for tracking

## Database Schema Overview

The database now includes:
- **User Management**: User, Session, Organization
- **Document Processing**: ProcessingSession, Job, FileAccessLog
- **Stripe Integration**: CreditPackage, PaymentMethod, Transaction
- **Model Configuration**: ModelConfiguration, FieldConfiguration, ModelAccess
- **Audit Trail**: AuditLog with IP tracking
- **Cleanup Tracking**: CleanupLog for maintenance