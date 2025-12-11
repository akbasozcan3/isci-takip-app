@echo off
echo Starting deployment...

if exist .env (
  echo .env file found
) else (
  echo .env file not found, using defaults
)

echo Installing dependencies...
call npm ci --only=production

echo Dependencies installed
echo Starting server...
node server.js
