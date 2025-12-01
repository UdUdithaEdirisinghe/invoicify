# Invoicify Setup & Verification Script
# Run this after setting your POSTGRES_URL in .env.local

Write-Host "=== Invoicify Setup Wizard ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check .env.local
Write-Host "[1/5] Checking environment configuration..." -ForegroundColor Yellow
$envFile = "c:\Users\udith\Desktop\invoice-app\.env.local"

if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    
    if ($content -match 'POSTGRES_URL="([^"]+)"') {
        $pgUrl = $matches[1]
        if ($pgUrl -eq "your_neon_connection_string_here") {
            Write-Host "❌ POSTGRES_URL not configured!" -ForegroundColor Red
            Write-Host "   Please update .env.local with your Neon connection string" -ForegroundColor Red
            Write-Host "   Get it from: https://console.neon.tech" -ForegroundColor Yellow
            exit 1
        } else {
            Write-Host "✓ POSTGRES_URL configured" -ForegroundColor Green
            $env:POSTGRES_URL = $pgUrl
        }
    }
    
    if ($content -match 'JWT_SECRET="([^"]+)"') {
        $jwtSecret = $matches[1]
        if ($jwtSecret -eq "change-this-to-a-random-secret-key-in-production") {
            Write-Host "⚠ JWT_SECRET using default - generating new one..." -ForegroundColor Yellow
            $newSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
            Write-Host "   Generated: $newSecret" -ForegroundColor Cyan
            Write-Host "   Please update JWT_SECRET in .env.local with this value" -ForegroundColor Yellow
            $env:JWT_SECRET = $newSecret
        } else {
            Write-Host "✓ JWT_SECRET configured" -ForegroundColor Green
            $env:JWT_SECRET = $jwtSecret
        }
    }
} else {
    Write-Host "❌ .env.local not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Database repair instructions
Write-Host "[2/5] Database Schema Repair" -ForegroundColor Yellow
Write-Host "   Open Neon SQL Editor: https://console.neon.tech" -ForegroundColor Cyan
Write-Host "   Run the SQL from: db/sql/repair_auth_schema.sql" -ForegroundColor Cyan
Write-Host "   This ensures users.password and user_settings.settings_data (JSONB) exist" -ForegroundColor Gray
Write-Host ""
$response = Read-Host "Have you run the repair script? (y/n)"
if ($response -ne "y") {
    Write-Host "Please run the SQL repair script first, then re-run this setup." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# 3. Start dev server
Write-Host "[3/5] Starting development server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\udith\Desktop\invoice-app'; `$env:POSTGRES_URL='$($env:POSTGRES_URL)'; `$env:JWT_SECRET='$($env:JWT_SECRET)'; npm run dev"
Start-Sleep -Seconds 3

Write-Host ""

# 4. Health check
Write-Host "[4/5] Testing API health..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get -TimeoutSec 5
    if ($health.status -eq "ok") {
        Write-Host "✓ API is healthy!" -ForegroundColor Green
        Write-Host "   Database connected: $($health.db.ok -eq 1)" -ForegroundColor Gray
    } else {
        Write-Host "⚠ API returned: $($health.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not reach API (server may still be starting)" -ForegroundColor Yellow
    Write-Host "   Check the dev server window for errors" -ForegroundColor Gray
}

Write-Host ""

# 5. Quick test instructions
Write-Host "[5/5] Manual Testing Steps" -ForegroundColor Yellow
Write-Host "   1. Open: http://localhost:3000/register.html" -ForegroundColor Cyan
Write-Host "   2. Create a test user" -ForegroundColor Cyan
Write-Host "   3. You should be redirected to dashboard" -ForegroundColor Cyan
Write-Host "   4. Check settings page works" -ForegroundColor Cyan
Write-Host "   5. Try creating an invoice" -ForegroundColor Cyan
Write-Host ""

Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host "Dev server is running in a separate window" -ForegroundColor Gray
Write-Host "Press any key to run API tests..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "=== Testing Registration API ===" -ForegroundColor Cyan
try {
    $testUser = @{
        username = "testuser_$(Get-Random -Maximum 9999)"
        email = "test_$(Get-Random -Maximum 9999)@example.com"
        password = "test123456"
    }
    
    $registerResult = Invoke-RestMethod -Uri "http://localhost:3000/api/auth?action=register" `
        -Method Post `
        -ContentType "application/json" `
        -Body ($testUser | ConvertTo-Json)
    
    if ($registerResult.token) {
        Write-Host "✓ Registration successful!" -ForegroundColor Green
        Write-Host "   Username: $($testUser.username)" -ForegroundColor Gray
        Write-Host "   Token: $($registerResult.token.Substring(0,20))..." -ForegroundColor Gray
        
        # Test getting user info
        Write-Host ""
        Write-Host "=== Testing Auth Token ===" -ForegroundColor Cyan
        $meResult = Invoke-RestMethod -Uri "http://localhost:3000/api/auth?action=me" `
            -Method Post `
            -Headers @{ Authorization = "Bearer $($registerResult.token)" }
        
        Write-Host "✓ Token valid! User: $($meResult.user.username)" -ForegroundColor Green
        
        # Test settings
        Write-Host ""
        Write-Host "=== Testing Settings API ===" -ForegroundColor Cyan
        $settingsResult = Invoke-RestMethod -Uri "http://localhost:3000/api/settings" `
            -Method Get `
            -Headers @{ Authorization = "Bearer $($registerResult.token)" }
        
        Write-Host "✓ Settings loaded!" -ForegroundColor Green
        Write-Host "   Currency: $($settingsResult.currency)" -ForegroundColor Gray
        Write-Host "   Theme: $($settingsResult.themeColor)" -ForegroundColor Gray
        
    } else {
        Write-Host "❌ Registration failed: $($registerResult | ConvertTo-Json)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ API test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Check the dev server logs for details" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== All Tests Complete ===" -ForegroundColor Green
Write-Host "If all tests passed, your app is ready!" -ForegroundColor Cyan
Write-Host "Dev server will continue running in the other window." -ForegroundColor Gray
