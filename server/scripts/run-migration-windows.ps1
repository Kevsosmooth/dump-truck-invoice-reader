# PowerShell script to run migration on Windows

Write-Host "🔧 Running database migration on Windows..." -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Split-Path -Parent $scriptDir

# Change to server directory
Set-Location $serverDir

# Step 1: Apply the schema fix SQL
Write-Host "📋 Step 1: Applying schema fixes..." -ForegroundColor Yellow
$fixSqlPath = Join-Path $scriptDir "fix-model-config-schema.sql"

# Use psql to apply the fix
# Adjust these values to match your PostgreSQL setup
$dbName = "dump-truck-invoice"
$dbUser = "postgres"

Write-Host "Running: psql -U $dbUser -d $dbName -f $fixSqlPath" -ForegroundColor Gray
psql -U $dbUser -d $dbName -f $fixSqlPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Schema fixes applied successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to apply schema fixes. Check your PostgreSQL connection." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Run the migration script
Write-Host "📋 Step 2: Running migration script..." -ForegroundColor Yellow
node scripts/migrate-env-simple.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Migration failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 All done! You can now remove AZURE_CUSTOM_MODEL_ID from your .env file." -ForegroundColor Cyan