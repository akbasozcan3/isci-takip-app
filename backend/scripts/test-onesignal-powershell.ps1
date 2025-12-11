# OneSignal API Key Test Script (PowerShell)
# Tests OneSignal API key directly using PowerShell

$AppId = "4a846145-621c-4a0d-a29f-0598da946c50"
$ApiKey = Get-Content -Path "..\.env" | Select-String -Pattern "ONESIGNAL_REST_API_KEY=" | ForEach-Object { ($_ -split "=")[1].Trim() }

if (-not $ApiKey) {
    Write-Host "❌ ONESIGNAL_REST_API_KEY not found in .env file" -ForegroundColor Red
    exit 1
}

# Remove quotes if present
$ApiKey = $ApiKey.Trim('"', "'").Trim()

Write-Host "`n🧪 OneSignal API Key Test (PowerShell)`n" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host "📋 App ID: $AppId"
Write-Host "📋 API Key Length: $($ApiKey.Length) characters"
Write-Host "📋 API Key Prefix: $($ApiKey.Substring(0, [Math]::Min(20, $ApiKey.Length)))..."
Write-Host ""

# Test Method 1: Basic Auth (app_id:api_key)
Write-Host "🔍 Testing Method 1: Basic Auth (app_id:api_key)..." -ForegroundColor Yellow
$basicAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${AppId}:${ApiKey}"))

$headers1 = @{
    "Authorization" = "Basic $basicAuth"
    "Content-Type" = "application/json"
}

try {
    $response1 = Invoke-RestMethod -Uri "https://onesignal.com/api/v1/apps/$AppId" -Headers $headers1 -Method Get -ErrorAction Stop
    Write-Host "✅ SUCCESS! Method 1 works!" -ForegroundColor Green
    Write-Host "   App Name: $($response1.name)" -ForegroundColor Green
    Write-Host "   App ID: $($response1.id)" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
    }
}

# Test Method 2: Key format
Write-Host "`n🔍 Testing Method 2: Key format..." -ForegroundColor Yellow
$headers2 = @{
    "Authorization" = "Key $ApiKey"
    "Content-Type" = "application/json"
}

try {
    $response2 = Invoke-RestMethod -Uri "https://onesignal.com/api/v1/apps/$AppId" -Headers $headers2 -Method Get -ErrorAction Stop
    Write-Host "✅ SUCCESS! Method 2 works!" -ForegroundColor Green
    Write-Host "   App Name: $($response2.name)" -ForegroundColor Green
    Write-Host "   App ID: $($response2.id)" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
    }
}

Write-Host "`n❌ Both methods failed. API key appears to be invalid." -ForegroundColor Red
Write-Host "`n💡 Solution:" -ForegroundColor Yellow
Write-Host "   1. Go to https://onesignal.com → Your App" -ForegroundColor White
Write-Host "   2. Settings → Keys & IDs" -ForegroundColor White
Write-Host "   3. Generate a NEW REST API Key" -ForegroundColor White
Write-Host "   4. Copy the FULL key (100+ characters)" -ForegroundColor White
Write-Host "   5. Update backend/.env: ONESIGNAL_REST_API_KEY=new_key" -ForegroundColor White
Write-Host "   6. Run: npm run fix-onesignal" -ForegroundColor White
Write-Host ""

exit 1

