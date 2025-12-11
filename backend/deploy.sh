#!/bin/bash
set -e

echo "🚀 Starting deployment..."

if [ -f .env ]; then
  echo "✅ .env file found"
else
  echo "⚠️  .env file not found, using defaults"
fi

echo "📦 Installing dependencies..."
npm ci --only=production

echo "✅ Dependencies installed"
echo "🎯 Starting server..."
node server.js
