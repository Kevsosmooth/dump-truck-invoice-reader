# Model Management Migration Guide

## Overview
This migration adds the model management system to your database, allowing admins to:
- Configure which Azure models users can access
- Rename models with user-friendly names
- Control which fields are exposed to users
- Set default values for missing fields

## New Tables
1. **ModelConfiguration** - Stores configured Azure models
2. **FieldConfiguration** - Stores field-level settings for each model
3. **ModelAccess** - Controls user/organization access to models

## Migration Steps

### Option 1: Using Prisma Migrate (Recommended)
If your database is running locally:
```bash
cd server
npx prisma migrate deploy
```

### Option 2: Manual Migration
If your database is hosted (e.g., on Supabase or another cloud provider):

1. Run the migration script:
```bash
cd server
node scripts/apply-model-management-migration.js
```

2. Or manually execute the SQL in:
```
server/prisma/migrations/20250113_model_management/migration.sql
```

### Option 3: Reset Database (Development Only)
If you're in development and don't have important data:
```bash
cd server
npx prisma migrate reset
```

## After Migration

1. **Restart the server** to load the new schema
2. **Access the Models page** in the admin dashboard
3. **Click "Sync with Azure"** to discover available models
4. **Configure models** with custom names and settings
5. **Set up field configurations** for each model

## Troubleshooting

If you see "Cannot read properties of undefined" errors:
1. Ensure the migration has been applied
2. Restart the server
3. Check that `npx prisma generate` has been run

## Environment Variables
No new environment variables are required for this feature.