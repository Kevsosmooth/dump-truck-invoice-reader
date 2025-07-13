@echo off
echo.
echo 🔧 Running database migration on Windows...
echo.

cd /d "%~dp0\.."

echo 📋 Step 1: Applying schema fixes...
echo Running: psql -U postgres -d dump-truck-invoice -f scripts\fix-model-config-schema.sql
psql -U postgres -d dump-truck-invoice -f scripts\fix-model-config-schema.sql

if %errorlevel% neq 0 (
    echo ❌ Failed to apply schema fixes. Check your PostgreSQL connection.
    pause
    exit /b 1
)

echo ✅ Schema fixes applied successfully!
echo.

echo 📋 Step 2: Running migration script...
node scripts\migrate-env-simple.js

if %errorlevel% neq 0 (
    echo ❌ Migration failed.
    pause
    exit /b 1
)

echo.
echo ✅ Migration completed successfully!
echo.
echo 🎉 All done! You can now remove AZURE_CUSTOM_MODEL_ID from your .env file.
echo.
pause