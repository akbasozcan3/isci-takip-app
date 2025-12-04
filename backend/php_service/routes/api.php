<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ApiController;

Route::get('/health', [ApiController::class, 'health']);

Route::post('/api/notifications/process', [ApiController::class, 'processNotifications']);
Route::get('/api/notifications/stats', [ApiController::class, 'getNotificationStats']);

