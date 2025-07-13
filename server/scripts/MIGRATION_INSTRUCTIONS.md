# Migration Instructions: Moving from .env to Database Configuration

This guide will help you migrate your Azure model configuration from the `.env` file to the database.

## Step 1: Fix the Database Schema

First, we need to ensure your database has the correct schema. The issue you're experiencing is that Prisma expects certain columns that don't exist yet.

1. Open your PostgreSQL client (pgAdmin, psql, or any tool you use)
2. Connect to your `dump-truck-invoice` database
3. Run the SQL script: `scripts/fix-database-schema.sql`

You can either:
- Copy and paste the contents of the file into your SQL client, OR
- If using psql command line:
  ```bash
  psql -U postgres -d dump-truck-invoice -f D:\Coding\React\dump-truck-invoice-reader\server\scripts\fix-database-schema.sql
  ```

This script will:
- Add the missing `displayName` column to ModelConfiguration
- Ensure all required columns exist
- Show you the final schema

## Step 2: Run the Migration Script

After the schema is fixed, run the migration script from your command prompt:

```bash
cd D:\Coding\React\dump-truck-invoice-reader\server
node scripts\migrate-env-to-db.js
```

This script will:
1. Read your `AZURE_CUSTOM_MODEL_ID` from the `.env` file
2. Create a model configuration in the database
3. Grant access to all existing users
4. Update any existing sessions/jobs to use the new configuration

## Step 3: Verify the Migration

The migration script will show you:
- The model configuration ID created
- Which users were granted access
- How many sessions/jobs were updated

## Step 4: Clean Up

After successful migration:
1. Remove or comment out `AZURE_CUSTOM_MODEL_ID` from your `.env` file
2. Restart your application

## What Changes After Migration?

- Users will see a dropdown of models they have access to (instead of using a single model from .env)
- Admins can manage model access from the admin dashboard
- Each user can have different models available to them
- Models can have custom display names per user

## Troubleshooting

If you get errors:

1. **"Can't reach database server"**: Make sure PostgreSQL is running on Windows
2. **"Column doesn't exist"**: Run the fix-database-schema.sql script first
3. **"Permission denied"**: Make sure you're using the correct database user

## Need Help?

If you encounter issues:
1. Check that PostgreSQL is running
2. Verify your database connection in the `.env` file
3. Make sure you ran the schema fix script first