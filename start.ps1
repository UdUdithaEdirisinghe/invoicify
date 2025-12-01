# Quick Start - Invoicify
# This script shows you the exact steps to get your app running

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   INVOICIFY - SETUP CHECKLIST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check environment
Write-Host "STEP 1: Environment Variables" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
$envPath = "c:\Users\udith\Desktop\invoice-app\.env.local"
$content = Get-Content $envPath -Raw

if ($content -match 'POSTGRES_URL="([^"]+)"') {
    $pgUrl = $matches[1]
    if ($pgUrl -like "*your_neon*") {
        Write-Host "❌ POSTGRES_URL: NOT SET" -ForegroundColor Red
        Write-Host "   Action Required:" -ForegroundColor Yellow
        Write-Host "   1. Go to https://console.neon.tech" -ForegroundColor White
        Write-Host "   2. Copy your connection string" -ForegroundColor White
        Write-Host "   3. Update .env.local file" -ForegroundColor White
        Write-Host ""
        exit 1
    } else {
        Write-Host "✓ POSTGRES_URL: Configured" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Cannot parse .env.local" -ForegroundColor Red
    exit 1
}

if ($content -match 'JWT_SECRET="([^"]+)"') {
    $jwt = $matches[1]
    if ($jwt -like "*change-this*") {
        Write-Host "⚠ JWT_SECRET: Using placeholder" -ForegroundColor Yellow
        $newSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
        Write-Host "   Generated new secret: $newSecret" -ForegroundColor Cyan
        Write-Host "   Update .env.local with this value for security" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "✓ JWT_SECRET: Configured" -ForegroundColor Green
    }
}

Write-Host ""

# Step 2: Database
Write-Host "STEP 2: Database Schema" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "You need to run this SQL in Neon:" -ForegroundColor White
Write-Host ""
Write-Host "   File: db\sql\repair_auth_schema.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "   1. Open https://console.neon.tech" -ForegroundColor White
Write-Host "   2. Click 'SQL Editor'" -ForegroundColor White
Write-Host "   3. Copy ALL contents from db\sql\repair_auth_schema.sql" -ForegroundColor White
Write-Host "   4. Paste and click 'Run' (or Ctrl+Enter)" -ForegroundColor White
Write-Host "   5. Should see 'COMMIT' success message" -ForegroundColor White
Write-Host ""
$dbDone = Read-Host "Have you run the SQL script? (y/n)"

if ($dbDone -ne "y" -and $dbDone -ne "Y") {
    Write-Host ""
    Write-Host "⚠ Please run the database script first!" -ForegroundColor Yellow
    Write-Host "   Opening repair script in notepad..." -ForegroundColor Gray
    Start-Process notepad "c:\Users\udith\Desktop\invoice-app\db\sql\repair_auth_schema.sql"
    Write-Host ""
    Write-Host "Re-run this script after completing the database setup." -ForegroundColor Cyan
    exit 0
}

Write-Host ""

# Step 3: Start Server
Write-Host "STEP 3: Starting Development Server" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# Extract and set environment variables
if ($content -match 'POSTGRES_URL="([^"]+)"') { $env:POSTGRES_URL = $matches[1] }
if ($content -match 'JWT_SECRET="([^"]+)"') { 
    $env:JWT_SECRET = $matches[1] 
} else {
    $env:JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

Write-Host "Starting server at http://localhost:3000 ..." -ForegroundColor Cyan
Write-Host ""

# Start server
npm run dev
