<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

class ApiController extends Controller
{
    private string $nodejsServiceUrl;

    public function __construct()
    {
        $this->nodejsServiceUrl = env('NODEJS_SERVICE_URL', 'http://localhost:4000');
    }

    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'service' => 'php-laravel-service',
            'version' => '1.0.0',
            'timestamp' => Carbon::now()->toIso8601String(),
            'uptime' => 'running'
        ]);
    }

    public function processNotifications(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required|string',
            'notifications' => 'required|array',
            'notifications.*.type' => 'required|string',
            'notifications.*.message' => 'required|string',
            'notifications.*.priority' => 'sometimes|string|in:low,medium,high'
        ]);

        $processed = [];
        foreach ($data['notifications'] as $notification) {
            $processed[] = [
                'user_id' => $data['user_id'],
                'type' => $notification['type'],
                'message' => $notification['message'],
                'priority' => $notification['priority'] ?? 'medium',
                'processed_at' => Carbon::now()->timestamp,
                'status' => 'queued'
            ];
        }

        return response()->json([
            'success' => true,
            'processed' => count($processed),
            'notifications' => $processed,
            'timestamp' => Carbon::now()->timestamp
        ]);
    }

    public function getNotificationStats(Request $request): JsonResponse
    {
        $userId = $request->query('user_id');
        
        if (!$userId) {
            return response()->json([
                'error' => 'user_id required'
            ], 400);
        }

        try {
            $response = Http::timeout(5)->get("{$this->nodejsServiceUrl}/api/notifications/{$userId}");
            
            if ($response->successful()) {
                $notifications = $response->json();
                $stats = [
                    'total' => count($notifications['notifications'] ?? []),
                    'unread' => count(array_filter($notifications['notifications'] ?? [], fn($n) => !($n['read'] ?? false))),
                    'by_type' => $this->groupByType($notifications['notifications'] ?? []),
                    'by_priority' => $this->groupByPriority($notifications['notifications'] ?? [])
                ];

                return response()->json([
                    'user_id' => $userId,
                    'stats' => $stats,
                    'timestamp' => Carbon::now()->timestamp
                ]);
            }
        } catch (\Exception $e) {
        }

        return response()->json([
            'user_id' => $userId,
            'stats' => [
                'total' => 0,
                'unread' => 0,
                'by_type' => [],
                'by_priority' => []
            ],
            'timestamp' => Carbon::now()->timestamp
        ]);
    }

    private function groupByType(array $notifications): array
    {
        $grouped = [];
        foreach ($notifications as $notification) {
            $type = $notification['type'] ?? 'unknown';
            $grouped[$type] = ($grouped[$type] ?? 0) + 1;
        }
        return $grouped;
    }

    private function groupByPriority(array $notifications): array
    {
        $grouped = ['low' => 0, 'medium' => 0, 'high' => 0];
        foreach ($notifications as $notification) {
            $priority = $notification['priority'] ?? 'medium';
            $grouped[$priority] = ($grouped[$priority] ?? 0) + 1;
        }
        return $grouped;
    }
}

