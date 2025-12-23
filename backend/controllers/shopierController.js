const ResponseFormatter = require('../core/utils/responseFormatter');
const crypto = require('crypto');

// BIN Database
const CARD_BIN_DATABASE = {
    '4546': { bank: 'Akbank', type: 'visa', country: 'TR', valid: true },
    '4355': { bank: 'Garanti BBVA', type: 'visa', country: 'TR', valid: true },
    '4508': { bank: 'İş Bankası', type: 'visa', country: 'TR', valid: true },
    '4603': { bank: 'Yapı Kredi', type: 'visa', country: 'TR', valid: true },
    '4289': { bank: 'Ziraat Bankası', type: 'visa', country: 'TR', valid: true },
    '4532': { bank: 'Halkbank', type: 'visa', country: 'TR', valid: true },
    '4506': { bank: 'Vakıfbank', type: 'visa', country: 'TR', valid: true },
    '5406': { bank: 'Akbank', type: 'mastercard', country: 'TR', valid: true },
    '5440': { bank: 'Garanti BBVA', type: 'mastercard', country: 'TR', valid: true },
    '5528': { bank: 'İş Bankası', type: 'mastercard', country: 'TR', valid: true },
    '5571': { bank: 'Yapı Kredi', type: 'mastercard', country: 'TR', valid: true },
    '5549': { bank: 'Ziraat Bankası', type: 'mastercard', country: 'TR', valid: true },
    '4111': { bank: 'Test Card', type: 'visa', country: 'US', valid: false, test: true },
    '4242': { bank: 'Test Card', type: 'visa', country: 'US', valid: false, test: true },
    '5555': { bank: 'Test Card', type: 'mastercard', country: 'US', valid: false, test: true },
};

class ShopierController {
    async createCheckout(req, res) {
        try {
            const userId = req.user?.id;
            const { planId, cardNumber, expiry, cvc, cardName } = req.body;

            if (!userId) {
                return res.status(401).json(
                    ResponseFormatter.error('Oturum açmanız gerekiyor', 'UNAUTHORIZED')
                );
            }

            if (!planId) {
                return res.status(400).json(
                    ResponseFormatter.error('Plan ID gerekli', 'MISSING_PLAN_ID')
                );
            }

            // Validate all card fields
            if (!cardNumber || !expiry || !cvc || !cardName) {
                return res.status(400).json(
                    ResponseFormatter.error('Tüm kart bilgileri gereklidir', 'MISSING_CARD_INFO')
                );
            }

            // Comprehensive card validation
            const validation = await this.validateCardComplete(cardNumber, expiry, cvc, cardName);

            if (!validation.isValid) {
                return res.status(400).json(
                    ResponseFormatter.error(
                        validation.error || 'Kart bilgileri geçersiz',
                        'INVALID_CARD',
                        {
                            field: validation.field,
                            errors: validation.errors,
                            warnings: validation.warnings,
                            cardInfo: validation.cardInfo
                        }
                    )
                );
            }

            // Log validated card info
            console.log(`[Shopier] Card validated: ${validation.cardInfo.bank} ${validation.cardInfo.type}`);

            // Generate transaction ID
            const transactionId = `txn_${crypto.randomBytes(12).toString('hex')}`;
            const paymentLink = `https://www.shopier.com/ShowProductNew/products.php?id=${transactionId}`;

            console.log(`[Shopier] Checkout created - User: ${userId}, Plan: ${planId}, Transaction: ${transactionId}`);

            return res.json(
                ResponseFormatter.success({
                    paymentLink,
                    transactionId,
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    cardInfo: validation.cardInfo,
                    message: `${validation.cardInfo.bank} kartınız doğrulandı. Shopier'e yönlendiriliyorsunuz...`
                })
            );
        } catch (error) {
            console.error('[Shopier] Create checkout error:', error);
            return res.status(500).json(
                ResponseFormatter.error('Ödeme linki oluşturulamadı', 'CHECKOUT_ERROR')
            );
        }
    }

    // Complete card validation with strict CVV and expiry checks
    async validateCardComplete(cardNumber, expiry, cvc, cardName) {
        const cleanCard = cardNumber.replace(/\s/g, '');
        const validation = {
            isValid: false,
            errors: [],
            warnings: [],
            cardInfo: null,
            error: null,
            field: null
        };

        // 1. Card Number Validation
        if (!cleanCard || cleanCard.length < 13 || cleanCard.length > 19) {
            validation.field = 'cardNumber';
            validation.error = 'Kart numarası 13-19 haneli olmalıdır';
            validation.errors.push(validation.error);
            return validation;
        }

        if (!/^\d+$/.test(cleanCard)) {
            validation.field = 'cardNumber';
            validation.error = 'Kart numarası sadece rakamlardan oluşmalıdır';
            validation.errors.push(validation.error);
            return validation;
        }

        // 2. Luhn Algorithm Check
        if (!this.luhnCheck(cleanCard)) {
            validation.field = 'cardNumber';
            validation.error = 'Geçersiz kart numarası. Lütfen kontrol edin.';
            validation.errors.push('Luhn algoritması başarısız');
            return validation;
        }

        // 3. BIN Check - Bank Identification
        const bin = cleanCard.substring(0, 4);
        const cardInfo = CARD_BIN_DATABASE[bin];

        if (!cardInfo) {
            validation.field = 'cardNumber';
            validation.error = 'Bu kart numarası tanınmadı. Lütfen geçerli bir Türk bankası kartı kullanın.';
            validation.errors.push('Bilinmeyen BIN');
            validation.warnings.push('Kart sistemde kayıtlı değil');
            return validation;
        }

        validation.cardInfo = {
            bank: cardInfo.bank,
            type: cardInfo.type,
            country: cardInfo.country,
            isTest: cardInfo.test || false
        };

        // 4. Test Card Check
        if (cardInfo.test) {
            validation.field = 'cardNumber';
            validation.error = 'Test kartları kabul edilmemektedir. Lütfen gerçek bir banka kartı kullanın.';
            validation.errors.push('Test kartı');
            validation.warnings.push(`${cardInfo.bank} - Test kartı`);
            return validation;
        }

        // 5. Valid for Payment Check
        if (!cardInfo.valid) {
            validation.field = 'cardNumber';
            validation.error = 'Bu kart ödeme için kullanılamaz';
            validation.errors.push('Kart geçersiz');
            return validation;
        }

        // 6. STRICT Expiry Date Validation
        if (!expiry || typeof expiry !== 'string') {
            validation.field = 'expiry';
            validation.error = 'Son kullanma tarihi gereklidir';
            validation.errors.push('Tarih eksik');
            return validation;
        }

        const expiryTrimmed = expiry.trim();

        // Check format MM/YY
        if (!/^\d{2}\/\d{2}$/.test(expiryTrimmed)) {
            validation.field = 'expiry';
            validation.error = 'Son kullanma tarihi formatı hatalı. Format: MM/YY (örn: 12/25)';
            validation.errors.push('Hatalı format');
            return validation;
        }

        const [monthStr, yearStr] = expiryTrimmed.split('/');
        const expMonth = parseInt(monthStr, 10);
        const expYear = parseInt('20' + yearStr, 10);

        // Validate month (01-12)
        if (expMonth < 1 || expMonth > 12) {
            validation.field = 'expiry';
            validation.error = `Geçersiz ay: ${monthStr}. Ay 01-12 arasında olmalıdır.`;
            validation.errors.push('Ay geçersiz');
            return validation;
        }

        // Validate year
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (expYear < currentYear) {
            validation.field = 'expiry';
            validation.error = `Kartınızın süresi dolmuş (${expiryTrimmed}). Lütfen geçerli bir kart kullanın.`;
            validation.errors.push('Süresi dolmuş');
            return validation;
        }

        if (expYear === currentYear && expMonth < currentMonth) {
            validation.field = 'expiry';
            validation.error = `Kartınızın süresi dolmuş (${expiryTrimmed}). Lütfen geçerli bir kart kullanın.`;
            validation.errors.push('Süresi dolmuş');
            return validation;
        }

        if (expYear > currentYear + 10) {
            validation.field = 'expiry';
            validation.error = `Son kullanma tarihi çok ileri bir tarih (${expiryTrimmed}). Lütfen kontrol edin.`;
            validation.errors.push('Tarih çok ileri');
            return validation;
        }

        // 7. STRICT CVV Validation
        if (!cvc || typeof cvc !== 'string') {
            validation.field = 'cvc';
            validation.error = 'CVV gereklidir';
            validation.errors.push('CVV eksik');
            return validation;
        }

        const cvcTrimmed = cvc.trim();

        // Check if only digits
        if (!/^\d+$/.test(cvcTrimmed)) {
            validation.field = 'cvc';
            validation.error = 'CVV sadece rakamlardan oluşmalıdır';
            validation.errors.push('CVV hatalı format');
            return validation;
        }

        // Check length (3 for Visa/MC, 4 for Amex)
        const cardType = validation.cardInfo.type;
        const expectedCvcLength = cardType === 'amex' ? 4 : 3;

        if (cvcTrimmed.length !== expectedCvcLength) {
            validation.field = 'cvc';
            validation.error = `CVV ${expectedCvcLength} haneli olmalıdır (${cardType === 'amex' ? 'American Express için 4' : 'Visa/Mastercard için 3'} hane)`;
            validation.errors.push(`CVV uzunluğu hatalı: ${cvcTrimmed.length} hane (${expectedCvcLength} olmalı)`);
            return validation;
        }

        // Check for invalid patterns (000, 111, 123, etc.)
        if (/^0+$/.test(cvcTrimmed)) {
            validation.field = 'cvc';
            validation.error = 'Geçersiz CVV. CVV 000 olamaz.';
            validation.errors.push('CVV geçersiz');
            return validation;
        }

        if (/^(.)\1+$/.test(cvcTrimmed)) {
            validation.field = 'cvc';
            validation.error = 'Geçersiz CVV. Lütfen kartınızın arkasındaki CVV kodunu girin.';
            validation.errors.push('CVV şüpheli');
            validation.warnings.push('Tekrarlayan rakamlar');
            return validation;
        }

        // 8. Card Name Validation
        if (!cardName || typeof cardName !== 'string') {
            validation.field = 'cardName';
            validation.error = 'Kart üzerindeki isim gereklidir';
            validation.errors.push('İsim eksik');
            return validation;
        }

        const nameTrimmed = cardName.trim();

        if (nameTrimmed.length < 3) {
            validation.field = 'cardName';
            validation.error = 'Kart üzerindeki isim en az 3 karakter olmalıdır';
            validation.errors.push('İsim çok kısa');
            return validation;
        }

        if (nameTrimmed.length > 50) {
            validation.field = 'cardName';
            validation.error = 'Kart üzerindeki isim çok uzun';
            validation.errors.push('İsim çok uzun');
            return validation;
        }

        // Check if name contains at least one space (first + last name)
        if (!nameTrimmed.includes(' ')) {
            validation.field = 'cardName';
            validation.error = 'Lütfen ad ve soyadınızı girin (örn: AHMET YILMAZ)';
            validation.errors.push('Soyad eksik');
            return validation;
        }

        // All validations passed!
        validation.isValid = true;
        return validation;
    }

    // Luhn Algorithm
    luhnCheck(cardNumber) {
        let sum = 0;
        let isEven = false;

        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let digit = parseInt(cardNumber[i]);

            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    // Check payment status
    async checkStatus(req, res) {
        try {
            const { transactionId } = req.params;

            if (!transactionId) {
                return res.status(400).json(
                    ResponseFormatter.error('Transaction ID gerekli', 'MISSING_TRANSACTION_ID')
                );
            }

            const statuses = ['pending', 'succeeded', 'failed'];
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

            return res.json(
                ResponseFormatter.success({
                    status: randomStatus,
                    shopierTransactionId: transactionId,
                    updatedAt: new Date().toISOString()
                })
            );
        } catch (error) {
            console.error('[Shopier] Check status error:', error);
            return res.status(500).json(
                ResponseFormatter.error('Ödeme durumu kontrol edilemedi', 'STATUS_ERROR')
            );
        }
    }

    // Webhook handler
    async webhook(req, res) {
        try {
            const { transaction_id, status, amount, plan_id } = req.body;
            console.log('[Shopier] Webhook received:', { transaction_id, status, amount, plan_id });
            return res.json({ success: true });
        } catch (error) {
            console.error('[Shopier] Webhook error:', error);
            return res.status(500).json({ success: false });
        }
    }
}

module.exports = new ShopierController();
