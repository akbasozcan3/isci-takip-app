# Bavaxe C# ASP.NET Core Service

## Requirements
- .NET 8.0 SDK

## Installation
```bash
dotnet restore
```

## Running
```bash
dotnet run
```

## Endpoints
- GET /api/health - Health check
- POST /api/reports/generate - Generate report
- GET /api/reports/list?user_id={id} - List reports
- GET /api/reports/download/{reportId} - Download report

