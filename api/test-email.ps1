$body = @{ email = "ozcanakbas38@gmail.com" } | ConvertTo-Json
$response = Invoke-RestMethod -Method POST -Uri "http://localhost:4000/auth/pre-verify-email" -ContentType "application/json" -Body $body
Write-Host "Response:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 5
