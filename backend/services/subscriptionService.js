// Subscription Service - Abonelik işlemleri için merkezi servis
const db = require('../config/database');
const SubscriptionModel = require('../core/database/models/subscription.model');
const activityLogService = require('./activityLogService');

class SubscriptionService {
  // Aboneliği aktifleştir
  static async activateSubscription(userId, planId, paymentData = {}) {
    if (!userId || !planId) {
      throw new Error('userId ve planId zorunludur');
    }

    const pricingService = require('./pricingService');
    
    const plans = {
      free: { name: 'Free', price: 0 },
      plus: { name: 'Plus', price: pricingService.getPrice('plus', 'TRY').try },
      business: { name: 'Business', price: pricingService.getPrice('business', 'TRY').try }
    };

    const plan = plans[planId];
    if (!plan) {
      throw new Error(`Geçersiz plan: ${planId}`);
    }

    const now = new Date();
    const renewsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const currentSubscription = db.getUserSubscription(userId);
    const isUpgrade = currentSubscription && this.isPlanUpgrade(currentSubscription.planId, planId);

    const gateway = paymentData.gateway || paymentData.paymentMethod || 'iyzico';
    
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
      transactionId: paymentData.transactionId || null,
      paymentMethod: gateway,
      gateway: gateway,
      updatedAt: now.toISOString()
    };

    if (currentSubscription && currentSubscription.planId !== 'free') {
      subscription.previousPlanId = currentSubscription.planId;
      subscription.previousPlanName = currentSubscription.planName;
    }

    db.setUserSubscription(userId, subscription);

    db.addBillingEvent(userId, {
      type: isUpgrade ? 'subscription_upgraded' : 'subscription_activated',
      planId,
      previousPlanId: currentSubscription?.planId,
      amount: plan.price,
      currency: 'TRY',
      paymentId: paymentData.paymentId,
      transactionId: paymentData.transactionId,
      gateway: paymentData.gateway,
      timestamp: now.getTime()
    });

    console.log(`[SubscriptionService] Subscription activated: User ${userId}, Plan ${planId} (${plan.name}), Amount ${plan.price} TRY, Payment ${paymentData.paymentId || 'N/A'}`);
    
    activityLogService.logActivity(userId, 'billing', isUpgrade ? 'upgrade_subscription' : 'activate_subscription', {
      planId,
      previousPlanId: currentSubscription?.planId,
      amount: plan.price,
      currency: 'TRY',
      paymentId: paymentData.paymentId,
      transactionId: paymentData.transactionId,
      gateway: paymentData.gateway
    });
    
    const notificationService = require('./notificationService');
    try {
      await notificationService.send(userId, {
        title: 'Abonelik Aktifleştirildi',
        message: `${plan.name} planınız başarıyla aktifleştirildi!`,
        type: 'success',
        deepLink: 'bavaxe://settings',
        data: { planId, planName: plan.name, type: 'subscription_activated' }
      }, ['database', 'onesignal']);
    } catch (notifError) {
      console.error('[SubscriptionService] Notification error:', notifError);
    }
    
    return subscription;
  }

  // Aboneliği iptal et
  static async cancelSubscription(userId, reason = 'user_requested') {
    const subscription = db.getUserSubscription(userId);
    if (!subscription || subscription.planId === 'free') {
      return null;
    }

    activityLogService.logActivity(userId, 'billing', 'cancel_subscription', {
      planId: subscription.planId,
      reason
    });

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
  static async renewSubscription(userId) {
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
  static async changePlan(userId, newPlanId, paymentData = {}) {
    const currentSubscription = db.getUserSubscription(userId);
    const oldPlanId = currentSubscription?.planId || 'free';

    if (oldPlanId === newPlanId) {
      return currentSubscription;
    }

    const isUpgrade = this.isPlanUpgrade(oldPlanId, newPlanId);
    const subscription = await this.activateSubscription(userId, newPlanId, paymentData);

    db.addBillingEvent(userId, {
      type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
      fromPlan: oldPlanId,
      toPlan: newPlanId,
      timestamp: Date.now()
    });

    const notificationService = require('./notificationService');
    const pricingService = require('./pricingService');
    const plans = {
      free: { name: 'Free' },
      plus: { name: 'Plus' },
      business: { name: 'Business' }
    };
    
    try {
      await notificationService.send(userId, {
        title: isUpgrade ? 'Plan Yükseltildi' : 'Plan Değiştirildi',
        message: `${plans[oldPlanId]?.name || oldPlanId} planından ${plans[newPlanId]?.name || newPlanId} planına geçtiniz.`,
        type: isUpgrade ? 'success' : 'info',
        deepLink: 'bavaxe://settings',
        data: { oldPlanId, newPlanId, type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded' }
      }, ['database', 'onesignal']);
    } catch (notifError) {
      console.error('[SubscriptionService] Notification error:', notifError);
    }

    return subscription;
  }

  // Plan upgrade mı kontrol et
  static isPlanUpgrade(fromPlan, toPlan) {
    const planOrder = { free: 0, plus: 1, business: 2 };
    return (planOrder[toPlan] || 0) > (planOrder[fromPlan] || 0);
  }

  // Süresi dolan abonelikleri kontrol et ve güncelle
  static async processExpiredSubscriptions() {
    const users = Object.values(db.data.users || {});
    let processed = 0;

    for (const user of users) {
      if (user.subscription && SubscriptionModel.isExpired(user.subscription)) {
        await this.cancelSubscription(user.id, 'expired');
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
setInterval(async () => {
  await SubscriptionService.processExpiredSubscriptions();
}, 60 * 60 * 1000);

module.exports = SubscriptionService;

