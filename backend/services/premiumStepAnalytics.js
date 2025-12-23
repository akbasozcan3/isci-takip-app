/**
 * Premium Step Analytics Service
 * Advanced analytics and insights for step data
 */

const Step = require('../modules/steps/steps.model');

class PremiumStepAnalytics {
    /**
     * Get weekly comparison analytics
     */
    async getWeeklyComparison(userId) {
        const thisWeek = await this.getWeekData(userId, 0);
        const lastWeek = await this.getWeekData(userId, 1);

        return {
            thisWeek: {
                total: thisWeek.reduce((sum, d) => sum + d.steps, 0),
                average: Math.round(thisWeek.reduce((sum, d) => sum + d.steps, 0) / 7),
                days: thisWeek
            },
            lastWeek: {
                total: lastWeek.reduce((sum, d) => sum + d.steps, 0),
                average: Math.round(lastWeek.reduce((sum, d) => sum + d.steps, 0) / 7),
                days: lastWeek
            },
            change: {
                steps: thisWeek.reduce((sum, d) => sum + d.steps, 0) - lastWeek.reduce((sum, d) => sum + d.steps, 0),
                percentage: lastWeek.reduce((sum, d) => sum + d.steps, 0) > 0
                    ? Math.round(((thisWeek.reduce((sum, d) => sum + d.steps, 0) - lastWeek.reduce((sum, d) => sum + d.steps, 0)) / lastWeek.reduce((sum, d) => sum + d.steps, 0)) * 100)
                    : 0
            }
        };
    }

    /**
     * Get week data helper
     */
    async getWeekData(userId, weeksAgo = 0) {
        const result = [];
        const now = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - (weeksAgo * 7 + i));
            const dateStr = date.toISOString().split('T')[0];

            const record = await Step.findOne({ userId, date: dateStr });
            result.unshift({
                date: dateStr,
                steps: record?.steps || 0,
                distance: record?.distance || 0,
                calories: record?.calories || 0
            });
        }

        return result;
    }

    /**
     * Get personalized insights
     */
    async getInsights(userId) {
        const today = new Date().toISOString().split('T')[0];
        const last30Days = await this.getLast30Days(userId);

        const insights = [];

        // Average steps insight
        const avgSteps = Math.round(last30Days.reduce((sum, d) => sum + d.steps, 0) / 30);
        const todaySteps = last30Days.find(d => d.date === today)?.steps || 0;

        if (todaySteps > avgSteps * 1.2) {
            insights.push({
                type: 'positive',
                icon: '🔥',
                title: 'Harika Performans!',
                message: `Bugün ortalamanızın %${Math.round(((todaySteps - avgSteps) / avgSteps) * 100)} üstünde adım attınız!`
            });
        }

        // Consistency insight
        const activeDays = last30Days.filter(d => d.steps > 1000).length;
        const consistency = Math.round((activeDays / 30) * 100);

        if (consistency >= 80) {
            insights.push({
                type: 'achievement',
                icon: '💪',
                title: 'Müthiş Tutarlılık',
                message: `Son 30 günün %${consistency}'inde aktifsiniz!`
            });
        }

        // Best day insight
        const bestDay = last30Days.reduce((best, current) =>
            current.steps > best.steps ? current : best, last30Days[0]);

        if (bestDay.steps > 0) {
            insights.push({
                type: 'info',
                icon: '🏆',
                title: 'En İyi Gününüz',
                message: `${bestDay.date} tarihinde ${bestDay.steps.toLocaleString()} adım attınız!`
            });
        }

        // Trend insight
        const firstHalf = last30Days.slice(0, 15);
        const secondHalf = last30Days.slice(15);
        const firstAvg = firstHalf.reduce((sum, d) => sum + d.steps, 0) / 15;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.steps, 0) / 15;

        if (secondAvg > firstAvg * 1.1) {
            insights.push({
                type: 'trend',
                icon: '📈',
                title: 'Yükseliş Trendi',
                message: 'Son 2 haftada adım sayınız artış gösteriyor!'
            });
        } else if (secondAvg < firstAvg * 0.9) {
            insights.push({
                type: 'warning',
                icon: '📉',
                title: 'Dikkat',
                message: 'Son 2 haftada aktiviteniz azaldı. Hedefinize odaklanın!'
            });
        }

        return insights;
    }

    /**
     * Get last 30 days data
     */
    async getLast30Days(userId) {
        const result = [];
        const now = new Date();

        for (let i = 0; i < 30; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const record = await Step.findOne({ userId, date: dateStr });
            result.unshift({
                date: dateStr,
                steps: record?.steps || 0,
                distance: record?.distance || 0,
                calories: record?.calories || 0
            });
        }

        return result;
    }

    /**
     * Predict next week's performance
     */
    async predictNextWeek(userId) {
        const last30Days = await this.getLast30Days(userId);
        const avgSteps = Math.round(last30Days.reduce((sum, d) => sum + d.steps, 0) / 30);

        // Simple linear trend
        const firstWeek = last30Days.slice(0, 7);
        const lastWeek = last30Days.slice(-7);
        const firstAvg = firstWeek.reduce((sum, d) => sum + d.steps, 0) / 7;
        const lastAvg = lastWeek.reduce((sum, d) => sum + d.steps, 0) / 7;
        const trend = (lastAvg - firstAvg) / 3; // Gradual change

        const prediction = Math.max(0, Math.round(lastAvg + trend));

        return {
            predictedSteps: prediction,
            confidence: 'medium',
            message: prediction > avgSteps
                ? 'Mevcut trendiniz devam ederse önümüzdeki hafta daha iyi olacak!'
                : 'Hedefinize ulaşmak için bu hafta daha aktif olmalısınız.'
        };
    }

    /**
     * Get health score (0-100)
     */
    async getHealthScore(userId) {
        const last7Days = await this.getWeekData(userId, 0);
        const avgSteps = last7Days.reduce((sum, d) => sum + d.steps, 0) / 7;

        // Score based on WHO recommendation (7000-10000 steps/day)
        let score = 0;

        // Base score from average steps
        if (avgSteps >= 10000) score += 50;
        else if (avgSteps >= 7000) score += 40;
        else if (avgSteps >= 5000) score += 30;
        else score += Math.round((avgSteps / 5000) * 30);

        // Consistency bonus
        const activeDays = last7Days.filter(d => d.steps > 3000).length;
        score += Math.round((activeDays / 7) * 30);

        // Weekly target bonus
        const weeklyTotal = last7Days.reduce((sum, d) => sum + d.steps, 0);
        if (weeklyTotal >= 70000) score += 20;
        else if (weeklyTotal >= 49000) score += 10;

        return {
            score: Math.min(100, score),
            level: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'needs_improvement',
            recommendations: this.getRecommendations(score, avgSteps)
        };
    }

    /**
     * Get personalized recommendations
     */
    getRecommendations(score, avgSteps) {
        const recommendations = [];

        if (score < 40) {
            recommendations.push('Günde en az 5000 adım atmaya çalışın');
            recommendations.push('Küçük hedeflerle başlayın ve kademeli artırın');
        } else if (score < 60) {
            recommendations.push('Günlük adım hedefinizi artırın');
            recommendations.push('Haftada en az 5 gün aktif olun');
        } else if (score < 80) {
            recommendations.push('10.000 adım hedefine yaklaşıyorsunuz');
            recommendations.push('Tutarlı kalmaya devam edin');
        } else {
            recommendations.push('Mükemmel performans!');
            recommendations.push('Bu tempoyu koruyun');
        }

        return recommendations;
    }
}

module.exports = new PremiumStepAnalytics();
