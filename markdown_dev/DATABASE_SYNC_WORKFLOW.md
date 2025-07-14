# Database Synchronization Workflow

## Overview
This document outlines the critical process of keeping database schemas synchronized between local PostgreSQL development and Supabase production environments. Following this workflow prevents schema drift and ensures smooth deployments.

## Environments

### Local Development
- **Database**: PostgreSQL (local instance)
- **Tool**: Prisma ORM
- **Connection**: `DATABASE_URL` in `.env`
- **Purpose**: Development and testing

### Production
- **Database**: Supabase PostgreSQL
- **Tool**: Supabase MCP (Model Context Protocol)
- **Connection**: `https://tnbplzwfumvyqyedtrdf.supabase.co`
- **Purpose**: Production deployment

## Migration Workflow

### Step 1: Create Migration Locally
```bash
# 1. Make schema changes in prisma/schema.prisma
# Example: Add transformation fields to FieldConfiguration

# 2. Create migration
npx prisma migrate dev --name add_field_transformations

# 3. Migration created at:
# prisma/migrations/20250114123456_add_field_transformations/migration.sql
```

### Step 2: Test Migration Locally
```bash
# 1. Verify migration applied
npx prisma migrate status

# 2. Test application with new schema
npm run dev

# 3. Run tests
npm test
```

### Step 3: Prepare for Supabase
```bash
# 1. Review the generated SQL
cat prisma/migrations/20250114123456_add_field_transformations/migration.sql

# 2. Check for Supabase compatibility:
# - Remove any Prisma-specific comments
# - Ensure all SQL is PostgreSQL compatible
# - Check for any local-only extensions
```

### Step 4: Apply to Supabase
In Claude Code, use the Supabase MCP:

```javascript
// 1. First, check current schema
mcp__supabase__list_tables({
  schemas: ["public"]
})

// 2. Apply the migration
mcp__supabase__apply_migration({
  name: "add_field_transformations",
  query: `
    -- Your migration SQL here
    ALTER TABLE "FieldConfiguration" 
    ADD COLUMN "transformationType" "TransformationType" DEFAULT 'NONE',
    ADD COLUMN "transformationConfig" JSONB;
  `
})

// 3. Verify migration applied
mcp__supabase__list_migrations()
```

### Step 5: Verify Synchronization
```javascript
// In Claude Code, verify schema matches
mcp__supabase__execute_sql({
  query: `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'FieldConfiguration'
    ORDER BY ordinal_position;
  `
})
```

## Schema Change Examples

### Adding a New Column
```sql
-- Local (Prisma migration)
ALTER TABLE "ModelConfiguration" 
ADD COLUMN "isDeprecated" BOOLEAN DEFAULT false;

-- Supabase (via MCP)
mcp__supabase__apply_migration({
  name: "add_model_deprecated_flag",
  query: `
    ALTER TABLE "ModelConfiguration" 
    ADD COLUMN "isDeprecated" BOOLEAN DEFAULT false;
  `
})
```

### Creating a New Enum
```sql
-- Local (Prisma handles enum creation)
CREATE TYPE "TransformationType" AS ENUM (
  'NONE', 
  'DATE_PARSE', 
  'NUMBER_FORMAT', 
  'TEXT_REPLACE', 
  'CUSTOM'
);

-- Supabase (check if exists first)
mcp__supabase__execute_sql({
  query: `
    DO $$ BEGIN
      CREATE TYPE "TransformationType" AS ENUM (
        'NONE', 
        'DATE_PARSE', 
        'NUMBER_FORMAT', 
        'TEXT_REPLACE', 
        'CUSTOM'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `
})
```

### Adding Indexes
```sql
-- Local
CREATE INDEX "idx_field_config_model_id" 
ON "FieldConfiguration"("modelConfigId");

-- Supabase
mcp__supabase__apply_migration({
  name: "add_field_config_index",
  query: `
    CREATE INDEX IF NOT EXISTS "idx_field_config_model_id" 
    ON "FieldConfiguration"("modelConfigId");
  `
})
```

## Pre-Deployment Checklist

### Before Feature Branch Merge
- [ ] All Prisma migrations created and tested locally
- [ ] Migration SQL reviewed for compatibility
- [ ] Application tested with new schema

### Before Development → Main Merge
- [ ] All migrations applied to Supabase
- [ ] Schema verification completed
- [ ] No pending migrations in `prisma migrate status`
- [ ] Supabase schema matches local exactly

### Production Deployment
- [ ] Backup Supabase database (if needed)
- [ ] Document any manual migration steps
- [ ] Prepare rollback plan

## Common Issues and Solutions

### Issue: Enum Already Exists
```sql
-- Problem: CREATE TYPE fails if enum exists
-- Solution: Use conditional creation
DO $$ BEGIN
  CREATE TYPE "YourEnum" AS ENUM ('VALUE1', 'VALUE2');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

### Issue: Column Type Mismatch
```sql
-- Problem: Prisma uses different type than Supabase
-- Solution: Ensure consistent types
-- Prisma: DateTime
-- PostgreSQL: TIMESTAMP WITH TIME ZONE
ALTER TABLE "YourTable" 
ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
```

### Issue: Foreign Key Constraints
```sql
-- Always add constraints AFTER creating tables
ALTER TABLE "ChildTable"
ADD CONSTRAINT "fk_parent_id"
FOREIGN KEY ("parentId") 
REFERENCES "ParentTable"("id") 
ON DELETE CASCADE;
```

## Rollback Procedures

### Local Rollback
```bash
# Revert last migration
npx prisma migrate resolve --rolled-back 20250114123456_add_field_transformations

# Or reset to specific migration
npx prisma migrate reset --to-migration 20250113000000_previous_migration
```

### Supabase Rollback
```javascript
// Create a rollback migration
mcp__supabase__apply_migration({
  name: "rollback_field_transformations",
  query: `
    -- Reverse the changes
    ALTER TABLE "FieldConfiguration" 
    DROP COLUMN IF EXISTS "transformationType",
    DROP COLUMN IF EXISTS "transformationConfig";
    
    -- Drop enum if created
    DROP TYPE IF EXISTS "TransformationType";
  `
})
```

## Best Practices

### 1. Always Test First
- Run migrations on local database
- Test all affected features
- Verify data integrity

### 2. Use Transactions
```sql
BEGIN;
  -- Your migration statements
  ALTER TABLE ...;
  CREATE INDEX ...;
COMMIT;
```

### 3. Document Complex Migrations
```sql
-- Migration: add_field_transformations
-- Purpose: Enable field value transformations for date parsing
-- Author: Team
-- Date: 2025-01-14
-- Dependencies: FieldConfiguration table must exist
```

### 4. Handle Data Migrations Carefully
```sql
-- Bad: Hardcoded IDs
UPDATE "FieldConfiguration" SET "transformationType" = 'DATE_PARSE' 
WHERE "id" = '123-456-789';

-- Good: Conditional updates
UPDATE "FieldConfiguration" SET "transformationType" = 'DATE_PARSE' 
WHERE "fieldType" = 'DATE' AND "transformationType" IS NULL;
```

### 5. Monitor After Deployment
- Check Supabase logs for errors
- Verify application functionality
- Monitor performance metrics

## Emergency Contacts

### Schema Issues
1. Check Supabase logs: `mcp__supabase__get_logs({ service: "postgres" })`
2. Verify connections are working
3. Check for lock conflicts

### Migration Failures
1. DO NOT PANIC
2. Document the error message
3. Check if partial migration applied
4. Plan rollback if needed
5. Communicate with team

## Automation Opportunities

### Future Improvements
1. **CI/CD Integration**
   - Automate migration testing
   - Schema comparison tools
   - Automated Supabase deployment

2. **Monitoring**
   - Schema drift detection
   - Migration status dashboard
   - Automated alerts

3. **Backup Strategy**
   - Pre-migration snapshots
   - Point-in-time recovery
   - Test restore procedures

## Summary

1. **Create migrations locally with Prisma**
2. **Test thoroughly in development**
3. **Apply to Supabase using MCP**
4. **Verify schema synchronization**
5. **Document all manual steps**
6. **Monitor after deployment**

Following this workflow ensures:
- Zero downtime deployments
- Consistent schemas across environments
- Easy rollback capabilities
- Clear audit trail
- Team coordination