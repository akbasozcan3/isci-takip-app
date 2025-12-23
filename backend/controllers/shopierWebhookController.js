/**
 * Shopier Webhook Controller
 * Handles Shopier payment webhooks with professional error handling
 */

const shopierService = require('../services/shopierService');
const subscriptionService = require('../services/subscriptionService');
const ResponseFormatter = require('../core/utils/responseFormatter');
const paymentLogger = require('../services/paymentTransactionLogger');

class ShopierWebhookController {
    /**
     * Handle Shopier webhook
     * POST /api/webhook/shopier
     */
    async handleWebhook(req, res) {
        const startTime = Date.now();

        try {
            // Log webhook received
            paymentLogger.logWebhook('shopier_webhook', 'shopier', 'received', {
                body: req.body,
                headers: req.headers,
                ip: req.ip
            });

            // Validate webhook data
            if (!req.body || Object.keys(req.body).length === 0) {
                return res.status(400).json(
                    ResponseFormatter.error('Webhook data boş', 'EMPTY_WEBHOOK')
                );
            }

            // Process webhook
            const result = await shopierService.processWebhook(req.body);

            if (!result.success) {
                paymentLogger.log('warn', 'shopier_webhook', 'Webhook processed but payment not successful', result);

                return res.json(ResponseFormatter.success({
                    message: 'Webhook alındı ama ödeme başarısız',
                    ...result
                }));
            }

            // Payment successful - activate subscription
            if (result.userId && result.planId) {
                try {
                    const subscription = await subscriptionService.activateSubscription(
                        result.userId,
                        result.planId,
                        {
                            paymentId: result.shopierTransactionId,
                            transactionId: result.transactionId,
                            gateway: 'shopier'
                        }
                    );

                    paymentLogger.logPaymentSuccess(
                        result.transactionId,
                        result.shopierTransactionId,
                        'shopier'
                    );

                    const processingTime = Date.now() - startTime;
                    console.log(`[ShopierWebhook] ✅ Payment successful: User ${result.userId}, Plan ${result.planId}, Transaction ${result.transactionId}, Time: ${processingTime}ms`);

                    return res.json(ResponseFormatter.success({
                        message: 'Ödeme başarılı, abonelik aktifleştirildi',
                        subscription,
                        transactionId: result.transactionId,
                        processingTime: `${processingTime}ms`
                    }));
                } catch (subscriptionError) {
                    console.error('[ShopierWebhook] Subscription activation error:', subscriptionError);

                    paymentLogger.log('error', 'shopier_webhook', 'Subscription activation failed', {
                        error: subscriptionError.message,
                        userId: result.userId,
                        planId: result.planId
                    });

                    // Payment succeeded but subscription failed - this is critical
                    return res.status(500).json(
                        ResponseFormatter.error(
                            'Ödeme başarılı ama abonelik aktifleştirilemedi',
                            'SUBSCRIPTION_ACTIVATION_FAILED',
                            {
                                transactionId: result.transactionId,
                                userId: result.userId,
                                planId: result.planId,
                                shopierTransactionId: result.shopierTransactionId
                            }
                        )
                    );
                }
            } else {
                // Missing user or plan info
                paymentLogger.log('warn', 'shopier_webhook', 'Missing userId or planId in webhook result', result);

                return res.json(ResponseFormatter.success({
                    message: 'Webhook işlendi ama kullanıcı/plan bilgisi eksik',
                    ...result
                }));
            }
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error('[ShopierWebhook] Error:', error);

            paymentLogger.log('error', 'shopier_webhook', 'Webhook processing error', {
                error: error.message,
                stack: error.stack,
                processingTime: `${processingTime}ms`
            });

            return res.status(500).json(
                ResponseFormatter.error(
                    'Webhook işlenemedi',
                    'WEBHOOK_PROCESSING_ERROR',
                    {
                        error: error.message,
                        processingTime: `${processingTime}ms`
                    }
                )
            );
        }
    }

    /**
     * Get webhook status/health
     * GET /api/webhook/shopier/status
     */
    async getWebhookStatus(req, res) {
        try {
            const stats = shopierService.getTransactionStats();

            return res.json(ResponseFormatter.success({
                status: 'operational',
                gateway: 'shopier',
                stats,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('[ShopierWebhook] Status check error:', error);
            return res.status(500).json(
                ResponseFormatter.error('Status kontrol edilemedi', 'STATUS_ERROR')
            );
        }
    }

    /**
     * Retry a failed payment
     * POST /api/webhook/shopier/retry/:transactionId
     */
    async retryPayment(req, res) {
        try {
            const { transactionId } = req.params;
            const user = req.user;

            if (!user) {
                return res.status(401).json(
                    ResponseFormatter.error('Authentication required', 'AUTH_REQUIRED')
                );
            }

            // Verify transaction belongs to user
            const transaction = shopierService.getTransaction(transactionId);
            if (!transaction) {
                return res.status(404).json(
                    ResponseFormatter.error('Transaction bulunamadı', 'TRANSACTION_NOT_FOUND')
                );
            }

            if (transaction.userId !== user.id) {
                return res.status(403).json(
                    ResponseFormatter.error('Bu transaction size ait değil', 'UNAUTHORIZED')
                );
            }

            const result = await shopierService.retryPayment(transactionId);

            return res.json(ResponseFormatter.success({
                message: 'Yeni ödeme linki oluşturuldu',
                ...result
            }));
        } catch (error) {
            console.error('[ShopierWebhook] Retry error:', error);
            return res.status(500).json(
                ResponseFormatter.error(
                    error.message || 'Retry işlemi başarısız',
                    'RETRY_ERROR'
                )
            );
        }
    }
}

module.exports = new ShopierWebhookController();
