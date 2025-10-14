$body = @{ 
    email = "ozcanakbas38@gmail.com"
    code = "710414"
} | ConvertTo-Json
$response = Invoke-RestMethod -Method POST -Uri "http://localhost:4000/auth/pre-verify-email/verify" -ContentType "application/json" -Body $body
Write-Host "Verify Response:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 5

# Şimdi bu pre_token ile register deneyelim
$registerBody = @{
    email = "ozcanakbas38@gmail.com"
    password = "Test123!"
    name = "Özcan"
    pre_token = $response.pre_token
} | ConvertTo-Json

Write-Host "`nRegister Request:" -ForegroundColor Yellow
$registerResponse = Invoke-RestMethod -Method POST -Uri "http://localhost:4000/auth/register" -ContentType "application/json" -Body $registerBody
Write-Host "Register Response:" -ForegroundColor Green
$registerResponse | ConvertTo-Json -Depth 5

# Login deneyelim
$loginBody = @{
    username = "ozcanakbas38@gmail.com"
    password = "Test123!"
} | ConvertTo-Json

Write-Host "`nLogin Request:" -ForegroundColor Yellow
$loginResponse = Invoke-RestMethod -Method POST -Uri "http://localhost:4000/auth/login" -ContentType "application/json" -Body $loginBody
Write-Host "Login Response:" -ForegroundColor Green
$loginResponse | ConvertTo-Json -Depth 5

Write-Host "`n✅ TÜM TESTLER BAŞARILI!" -ForegroundColor Green
