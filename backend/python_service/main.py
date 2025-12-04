from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import asyncio
import aiohttp
import json
from pydantic import BaseModel

app = FastAPI(title="Bavaxe Analytics API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LocationData(BaseModel):
    latitude: float
    longitude: float
    timestamp: int
    accuracy: Optional[float] = None
    speed: Optional[float] = None

class AnalyticsRequest(BaseModel):
    user_id: str
    date_range: Optional[str] = "7d"
    metrics: Optional[List[str]] = None

class PredictionRequest(BaseModel):
    user_id: str
    locations: List[LocationData]
    prediction_type: str = "route"

NODEJS_SERVICE_URL = "http://localhost:4000"
REDIS_URL = "redis://localhost:6379"

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "python-analytics",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": "running"
    }

@app.get("/api/analytics/{user_id}")
async def get_analytics(
    user_id: str,
    date_range: str = "7d",
    x_date_range: Optional[str] = Header(None, alias="X-Date-Range")
):
    try:
        range_to_use = x_date_range or date_range
        analytics = await fetch_analytics_data(user_id, range_to_use)
        
        return {
            "user_id": user_id,
            "date_range": range_to_use,
            "summary": analytics.get("summary", {}),
            "trends": analytics.get("trends", {}),
            "predictions": await generate_predictions(user_id, analytics),
            "insights": await generate_insights(user_id, analytics),
            "anomalies": await detect_anomalies(user_id, analytics)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/predict")
async def predict_route(request: PredictionRequest):
    try:
        predictions = await ml_predict_route(request.user_id, request.locations, request.prediction_type)
        return {
            "user_id": request.user_id,
            "prediction_type": request.prediction_type,
            "predictions": predictions,
            "confidence": predictions.get("confidence", 0.0)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/insights/{user_id}")
async def get_insights(user_id: str, date_range: str = "30d"):
    try:
        analytics = await fetch_analytics_data(user_id, date_range)
        insights = await generate_insights(user_id, analytics)
        
        return {
            "user_id": user_id,
            "insights": insights,
            "recommendations": await generate_recommendations(user_id, insights),
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def fetch_analytics_data(user_id: str, date_range: str) -> Dict:
    async with aiohttp.ClientSession() as session:
        try:
            url = f"{NODEJS_SERVICE_URL}/api/analytics/{user_id}"
            async with session.get(url, params={"date_range": date_range}) as response:
                if response.status == 200:
                    return await response.json()
                return {}
        except Exception as e:
            print(f"Error fetching analytics: {e}")
            return {}

async def generate_predictions(user_id: str, analytics: Dict) -> Dict:
    summary = analytics.get("summary", {})
    
    predictions = {
        "next_location_probability": calculate_location_probability(summary),
        "estimated_daily_distance": estimate_daily_distance(summary),
        "route_optimization": suggest_route_optimization(summary),
        "time_estimates": estimate_travel_times(summary)
    }
    
    return predictions

async def generate_insights(user_id: str, analytics: Dict) -> List[Dict]:
    summary = analytics.get("summary", {})
    trends = analytics.get("trends", {})
    
    insights = []
    
    if summary.get("total_distance", 0) > 100:
        insights.append({
            "type": "high_activity",
            "message": "Yüksek aktivite seviyesi tespit edildi",
            "severity": "info"
        })
    
    if trends.get("distance_trend", {}).get("trend") == "decreasing":
        insights.append({
            "type": "decreasing_activity",
            "message": "Aktivite seviyesi düşüyor",
            "severity": "warning"
        })
    
    return insights

async def detect_anomalies(user_id: str, analytics: Dict) -> List[Dict]:
    summary = analytics.get("summary", {})
    anomalies = []
    
    avg_distance = summary.get("average_daily_distance", 0)
    if avg_distance > 200:
        anomalies.append({
            "type": "unusual_distance",
            "message": "Olağandışı mesafe tespit edildi",
            "severity": "high",
            "value": avg_distance
        })
    
    return anomalies

async def generate_recommendations(user_id: str, insights: List[Dict]) -> List[str]:
    recommendations = []
    
    for insight in insights:
        if insight["type"] == "decreasing_activity":
            recommendations.append("Aktivite seviyesini artırmak için daha fazla hareket önerilir")
        elif insight["type"] == "high_activity":
            recommendations.append("Yüksek aktivite seviyesi devam ediyor, performans iyi")
    
    return recommendations

def calculate_location_probability(summary: Dict) -> float:
    return 0.85

def estimate_daily_distance(summary: Dict) -> float:
    avg = summary.get("average_daily_distance", 0)
    return avg * 1.1

def suggest_route_optimization(summary: Dict) -> Dict:
    return {
        "potential_savings_km": 5.2,
        "optimization_score": 0.78
    }

def estimate_travel_times(summary: Dict) -> Dict:
    return {
        "estimated_hours": 8.5,
        "confidence": 0.82
    }

async def ml_predict_route(user_id: str, locations: List[LocationData], prediction_type: str) -> Dict:
    if prediction_type == "route":
        return {
            "predicted_route": "optimized",
            "estimated_time": 45,
            "confidence": 0.88
        }
    return {}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
