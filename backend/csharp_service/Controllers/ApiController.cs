using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace BavaxeCSharpService.Controllers;

[ApiController]
[Route("api")]
public class ApiController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly string _nodejsServiceUrl;

    public ApiController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _nodejsServiceUrl = _configuration["NodejsServiceUrl"] ?? "http://localhost:4000";
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new
        {
            status = "healthy",
            service = "csharp-aspnet-service",
            version = "1.0.0",
            timestamp = DateTime.UtcNow.ToString("O"),
            uptime = "running"
        });
    }

    [HttpPost("reports/generate")]
    public async Task<IActionResult> GenerateReport([FromBody] ReportRequest request)
    {
        if (string.IsNullOrEmpty(request.UserId) || string.IsNullOrEmpty(request.ReportType))
        {
            return BadRequest(new { error = "user_id and report_type required" });
        }

        var report = new
        {
            user_id = request.UserId,
            report_type = request.ReportType,
            generated_at = DateTime.UtcNow.ToString("O"),
            data = new
            {
                summary = new
                {
                    total_records = 150,
                    date_range = request.DateRange ?? "7d",
                    format = request.Format ?? "json"
                },
                sections = new[]
                {
                    new { name = "Overview", count = 45 },
                    new { name = "Details", count = 105 }
                }
            },
            download_url = $"/api/reports/download/{Guid.NewGuid()}"
        };

        return Ok(report);
    }

    [HttpGet("reports/list")]
    public async Task<IActionResult> ListReports([FromQuery] string user_id)
    {
        if (string.IsNullOrEmpty(user_id))
        {
            return BadRequest(new { error = "user_id required" });
        }

        try
        {
            var client = _httpClientFactory.CreateClient("default");
            client.Timeout = TimeSpan.FromSeconds(5);
            if (!client.DefaultRequestHeaders.Contains("Connection"))
            {
                client.DefaultRequestHeaders.Add("Connection", "keep-alive");
            }
            
            var response = await client.GetAsync($"{_nodejsServiceUrl}/api/analytics/{user_id}");
            
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var analytics = JsonSerializer.Deserialize<JsonElement>(content);
                
                var reports = new
                {
                    user_id = user_id,
                    available_reports = new[]
                    {
                        new { id = Guid.NewGuid().ToString(), type = "daily", created_at = DateTime.UtcNow.AddDays(-1).ToString("O") },
                        new { id = Guid.NewGuid().ToString(), type = "weekly", created_at = DateTime.UtcNow.AddDays(-7).ToString("O") },
                        new { id = Guid.NewGuid().ToString(), type = "monthly", created_at = DateTime.UtcNow.AddDays(-30).ToString("O") }
                    },
                    analytics_summary = analytics,
                    timestamp = DateTime.UtcNow.ToString("O")
                };

                return Ok(reports);
            }
        }
        catch
        {
        }

        var fallback = new
        {
            user_id = user_id,
            available_reports = new object[0],
            timestamp = DateTime.UtcNow.ToString("O")
        };

        return Ok(fallback);
    }

    [HttpGet("reports/download/{reportId}")]
    public IActionResult DownloadReport(string reportId)
    {
        var reportData = new
        {
            report_id = reportId,
            status = "ready",
            download_url = $"/api/reports/download/{reportId}/file",
            expires_at = DateTime.UtcNow.AddHours(24).ToString("O")
        };

        return Ok(reportData);
    }
}

public class ReportRequest
{
    public string? UserId { get; set; }
    public string? ReportType { get; set; }
    public string? DateRange { get; set; }
    public string? Format { get; set; }
}

