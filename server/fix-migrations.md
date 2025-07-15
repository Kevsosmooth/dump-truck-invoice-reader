# Fixing Prisma Migration Shadow Database Error

## The Problem
Prisma uses a "shadow database" to test migrations before applying them to your main database. This error occurs when:
1. The shadow database doesn't exist
2. There are inconsistencies between your schema and database
3. Old migrations are conflicting

## Solution 1: Create Shadow Database (Recommended)
```bash
# In PostgreSQL, create a shadow database:
psql -U postgres -c "CREATE DATABASE \"dump-truck-invoice-shadow\";"

# Then run migrations:
npx prisma migrate dev --name add-analytics-tracking
```

## Solution 2: Use db push instead of migrate (Quick Fix)
```bash
# This skips the migration system entirely
npx prisma db push
```

## Solution 3: Reset Everything (Nuclear Option)
```bash
# WARNING: This will delete all data!
# 1. Drop and recreate both databases
psql -U postgres -c "DROP DATABASE IF EXISTS \"dump-truck-invoice\";"
psql -U postgres -c "DROP DATABASE IF EXISTS \"dump-truck-invoice-shadow\";"
psql -U postgres -c "CREATE DATABASE \"dump-truck-invoice\";"
psql -U postgres -c "CREATE DATABASE \"dump-truck-invoice-shadow\";"

# 2. Remove migrations folder
rm -rf prisma/migrations

# 3. Create initial migration
npx prisma migrate dev --name init

# 4. Seed your admin user again
npm run seed
```

## Solution 4: Skip Shadow Database (Development Only)
```bash
# Use --skip-seed flag
npx prisma migrate dev --name add-analytics-tracking --skip-seed

# Or set environment variable
set PRISMA_MIGRATE_SKIP_SHADOW_DATABASE=true
npx prisma migrate dev --name add-analytics-tracking
```

## Permanent Fix
Add to your `.env`:
```env
SHADOW_DATABASE_URL="postgresql://postgres:password123@localhost:5432/dump-truck-invoice-shadow"
```

And in `schema.prisma`:
```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DIRECT_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

## Why This Keeps Happening
1. **Windows + WSL conflicts**: Sometimes the database connection gets confused between Windows and WSL
2. **Incomplete migrations**: Failed migrations leave the database in an inconsistent state
3. **Schema drift**: Manual database changes outside of Prisma cause conflicts

## Best Practices
1. Always use `npx prisma db push` for development
2. Only use `npx prisma migrate dev` when you need to track schema changes
3. Keep a backup of your schema.prisma file
4. Consider using a cloud database (like Supabase) to avoid local issues