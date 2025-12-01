# Test Change Password Functionality
# This script verifies the change password feature works correctly

Write-Host "=== Change Password Test ===" -ForegroundColor Cyan
Write-Host ""

# Test data
$testEmail = "testuser@example.com"
$testPassword = "oldpass123"
$newPassword = "newpass456"

Write-Host "Test Scenario:" -ForegroundColor Yellow
Write-Host "  1. Login with test user" -ForegroundColor Gray
Write-Host "  2. Change password" -ForegroundColor Gray
Write-Host "  3. Verify new password works" -ForegroundColor Gray
Write-Host ""

# Check if server is running
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running" -ForegroundColor Red
    Write-Host "   Please start server first:" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Step 1: Login" -ForegroundColor Yellow

try {
    $loginBody = @{
        email = $testEmail
        password = $testPassword
    } | ConvertTo-Json

    $loginResult = Invoke-RestMethod -Uri "http://localhost:3000/api/auth?action=login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop

    $token = $loginResult.token
    Write-Host "✓ Login successful" -ForegroundColor Green
    Write-Host "  Token: $($token.Substring(0,20))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Note: Make sure you have a test user registered" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Change Password" -ForegroundColor Yellow

try {
    $changePwBody = @{
        currentPassword = $testPassword
        newPassword = $newPassword
    } | ConvertTo-Json

    $changeResult = Invoke-RestMethod -Uri "http://localhost:3000/api/auth?action=change-password" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $token" } `
        -Body $changePwBody `
        -ErrorAction Stop

    Write-Host "✓ Password changed successfully" -ForegroundColor Green
    Write-Host "  Message: $($changeResult.message)" -ForegroundColor Gray
} catch {
    $errorMsg = $_.ErrorDetails.Message
    if ($errorMsg) {
        $errorObj = $errorMsg | ConvertFrom-Json
        Write-Host "❌ Change password failed: $($errorObj.error)" -ForegroundColor Red
    } else {
        Write-Host "❌ Change password failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verify New Password" -ForegroundColor Yellow

try {
    $verifyBody = @{
        email = $testEmail
        password = $newPassword
    } | ConvertTo-Json

    $verifyResult = Invoke-RestMethod -Uri "http://localhost:3000/api/auth?action=login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $verifyBody `
        -ErrorAction Stop

    Write-Host "✓ New password works!" -ForegroundColor Green
    Write-Host "  User: $($verifyResult.user.username)" -ForegroundColor Gray
} catch {
    Write-Host "❌ New password doesn't work" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 4: Restore Original Password" -ForegroundColor Yellow

try {
    $restoreBody = @{
        currentPassword = $newPassword
        newPassword = $testPassword
    } | ConvertTo-Json

    $restoreResult = Invoke-RestMethod -Uri "http://localhost:3000/api/auth?action=change-password" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $($verifyResult.token)" } `
        -Body $restoreBody `
        -ErrorAction Stop

    Write-Host "✓ Password restored to original" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not restore password (not critical)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== All Tests Passed! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Change Password Feature is working correctly ✓" -ForegroundColor Cyan
