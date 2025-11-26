// Subscription Service - Abonelik işlemleri için merkezi servis
const db = require('../config/database');
const SubscriptionModel = require('../models/subscription');

class SubscriptionService {
  // Aboneliği aktifleştir
  static activateSubscription(userId, planId, paymentData = {}) {
    const plans = {
      free: { name: 'Free', price: 0 },
      plus: { name: 'Plus', price: 699 },
      business: { name: 'Business', price: 999 }
    };

    const plan = plans[planId] || plans.free;
    const now = new Date();
    const renewsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = {
      planId,
      planName: plan.name,
      price: plan.price,
      currency: 'TRY',
      interval: 'monthly',
      status: 'active',
      activatedAt: now.toISOString(),
      renewsAt: renewsAt.toISOString(),
      paymentId: paymentData.paymentId || null,
      paymentMethod: paymentData.paymentMethod || 'iyzico',
      updatedAt: now.toISOString()
    };

    db.setUserSubscription(userId, subscription);

    // Billing event kaydet
    db.addBillingEvent(userId, {
      type: 'subscription_activated',
      planId,
      amount: plan.price,
      currency: 'TRY',
      paymentId: paymentData.paymentId,
      timestamp: now.getTime()
    });

    console.log(`[SubscriptionService] Subscription activated: ${userId} -> ${planId}`);
    return subscription;
  }

  // Aboneliği iptal et
  static cancelSubscription(userId, reason = 'user_requested') {
    const subscription = db.getUserSubscription(userId);
    if (!subscription || subscription.planId === 'free') {
      return null;
    }

    const updatedSubscription = {
      ...subscription,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelReason: reason,
      updatedAt: new Date().toISOString()
    };

    db.setUserSubscription(userId, updatedSubscription);

    db.addBillingEvent(userId, {
      type: 'subscription_cancelled',
      planId: subscription.planId,
      reason,
      timestamp: Date.now()
    });

    console.log(`[SubscriptionService] Subscription cancelled: ${userId}`);
    return updatedSubscription;
  }

  // Aboneliği yenile
  static renewSubscription(userId) {
    const subscription = db.getUserSubscription(userId);
    if (!subscription || subscription.planId === 'free') {
      return null;
    }

    const now = new Date();
    const renewsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updatedSubscription = {
      ...subscription,
      status: 'active',
      renewsAt: renewsAt.toISOString(),
      lastRenewedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    db.setUserSubscription(userId, updatedSubscription);

    db.addBillingEvent(userId, {
      type: 'subscription_renewed',
      planId: subscription.planId,
      amount: subscription.price,
      currency: subscription.currency,
      timestamp: now.getTime()
    });

    console.log(`[SubscriptionService] Subscription renewed: ${userId}`);
    return updatedSubscription;
  }

  // Plan değiştir (upgrade/downgrade)
  static changePlan(userId, newPlanId, paymentData = {}) {
    const currentSubscription = db.getUserSubscription(userId);
    const oldPlanId = currentSubscription?.planId || 'free';

    if (oldPlanId === newPlanId) {
      return currentSubscription;
    }

    const isUpgrade = this.isPlanUpgrade(oldPlanId, newPlanId);
    const subscription = this.activateSubscription(userId, newPlanId, paymentData);

    db.addBillingEvent(userId, {
      type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
      fromPlan: oldPlanId,
      toPlan: newPlanId,
      timestamp: Date.now()
    });

    return subscription;
  }

  // Plan upgrade mı kontrol et
  static isPlanUpgrade(fromPlan, toPlan) {
    const planOrder = { free: 0, plus: 1, business: 2 };
    return (planOrder[toPlan] || 0) > (planOrder[fromPlan] || 0);
  }

  // Süresi dolan abonelikleri kontrol et ve güncelle
  static processExpiredSubscriptions() {
    const users = Object.values(db.data.users || {});
    let processed = 0;

    for (const user of users) {
      if (user.subscription && SubscriptionModel.isExpired(user.subscription)) {
        this.cancelSubscription(user.id, 'expired');
        processed++;
      }
    }

    if (processed > 0) {
      console.log(`[SubscriptionService] Processed ${processed} expired subscriptions`);
    }

    return processed;
  }

  // Kullanıcının abonelik durumunu al
  static getSubscriptionStatus(userId) {
    const subscription = db.getUserSubscription(userId);
    const summary = SubscriptionModel.getSubscriptionSummary(userId);
    const history = db.getBillingHistory(userId);

    return {
      subscription: subscription || {
        planId: 'free',
        planName: 'Free',
        status: 'active'
      },
      summary,
      history: history.slice(0, 10),
      isActive: summary.isActive,
      isPremium: subscription?.planId !== 'free'
    };
  }
}

// Her saat süresi dolan abonelikleri kontrol et
setInterval(() => {
  SubscriptionService.processExpiredSubscriptions();
}, 60 * 60 * 1000);

module.exports = SubscriptionService;

