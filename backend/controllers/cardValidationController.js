const ResponseFormatter = require('../core/utils/responseFormatter');

// Real card BIN (Bank Identification Number) database
const CARD_BIN_DATABASE = {
    // Turkish Banks - Visa
    '4546': { bank: 'Akbank', type: 'visa', country: 'TR', valid: true },
    '4355': { bank: 'Garanti BBVA', type: 'visa', country: 'TR', valid: true },
    '4508': { bank: 'İş Bankası', type: 'visa', country: 'TR', valid: true },
    '4603': { bank: 'Yapı Kredi', type: 'visa', country: 'TR', valid: true },
    '4289': { bank: 'Ziraat Bankası', type: 'visa', country: 'TR', valid: true },
    '4532': { bank: 'Halkbank', type: 'visa', country: 'TR', valid: true },
    '4506': { bank: 'Vakıfbank', type: 'visa', country: 'TR', valid: true },
    '4022': { bank: 'QNB Finansbank', type: 'visa', country: 'TR', valid: true },
    '4043': { bank: 'Denizbank', type: 'visa', country: 'TR', valid: true },

    // Turkish Banks - Mastercard
    '5406': { bank: 'Akbank', type: 'mastercard', country: 'TR', valid: true },
    '5440': { bank: 'Garanti BBVA', type: 'mastercard', country: 'TR', valid: true },
    '5528': { bank: 'İş Bankası', type: 'mastercard', country: 'TR', valid: true },
    '5571': { bank: 'Yapı Kredi', type: 'mastercard', country: 'TR', valid: true },
    '5549': { bank: 'Ziraat Bankası', type: 'mastercard', country: 'TR', valid: true },
    '5504': { bank: 'Halkbank', type: 'mastercard', country: 'TR', valid: true },
    '5456': { bank: 'Vakıfbank', type: 'mastercard', country: 'TR', valid: true },

    // Test Cards (Invalid)
    '4111': { bank: 'Test Card', type: 'visa', country: 'US', valid: false, test: true },
    '4242': { bank: 'Test Card', type: 'visa', country: 'US', valid: false, test: true },
    '4000': { bank: 'Test Card', type: 'visa', country: 'US', valid: false, test: true },
    '5555': { bank: 'Test Card', type: 'mastercard', country: 'US', valid: false, test: true },
    '2223': { bank: 'Test Card', type: 'mastercard', country: 'US', valid: false, test: true },
};

class CardValidationController {
    // Validate card with real BIN check
    async validateCard(req, res) {
        try {

            const { cardNumber, expiry, cvc, cardName } = req.body;

            const cleanCard = cardNumber.replace(/\s/g, '');

            const validation = {
                isValid: false,
                errors: [],
                cardInfo: null,
                warnings: []
            };

            // 1. Card number length
            if (cleanCard.length < 13 || cleanCard.length > 19) {
                validation.errors.push('Kart numarası 13-19 haneli olmalıdır');
            }

            // 2. Only digits
            if (!/^\d+$/.test(cleanCard)) {
                validation.errors.push('Kart numarası sadece rakamlardan oluşmalıdır');
            }

            // 3. Luhn Algorithm
            if (!this.luhnCheck(cleanCard)) {
                validation.errors.push('Geçersiz kart numarası (Luhn algoritması başarısız)');
            }

            // 4. BIN Check
            const bin = cleanCard.substring(0, 4);
            const cardInfo = CARD_BIN_DATABASE[bin];

            if (!cardInfo) {
                validation.errors.push('Kart numarası tanınmadı. Lütfen geçerli bir Türk bankası kartı kullanın.');
                validation.warnings.push('Bu kart numarası sistemimizde kayıtlı değil');
            } else {
                validation.cardInfo = {
                    bank: cardInfo.bank,
                    type: cardInfo.type,
                    country: cardInfo.country,
                    isTest: cardInfo.test || false
                };

                if (cardInfo.test) {
                    validation.errors.push('Test kartları kabul edilmemektedir');
                    validation.warnings.push(`Bu bir test kartıdır (${cardInfo.bank})`);
                }

                if (!cardInfo.valid) {
                    validation.errors.push('Bu kart ödeme için kullanılamaz');
                }
            }

            // 5. Expiry validation
            if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
                validation.errors.push('Son kullanma tarihi formatı hatalı (MM/YY)');
            } else {
                const [month, year] = expiry.split('/');
                const expMonth = parseInt(month);
                const expYear = parseInt('20' + year);
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;

                if (expMonth < 1 || expMonth > 12) {
                    validation.errors.push('Geçersiz ay (01-12 arası olmalı)');
                }

                if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
                    validation.errors.push('Kartın süresi dolmuş');
                }

                if (expYear > currentYear + 10) {
                    validation.errors.push('Son kullanma tarihi çok ileri bir tarih');
                }
            }

            // 6. CVC validation
            if (!cvc || !/^\d{3,4}$/.test(cvc)) {
                validation.errors.push('CVV 3 veya 4 haneli olmalıdır');
            }

            // 7. Card name validation
            if (!cardName || cardName.trim().length < 3) {
                validation.errors.push('Kart üzerindeki isim en az 3 karakter olmalıdır');
            }

            validation.isValid = validation.errors.length === 0;

            if (!validation.isValid) {
                return res.status(400).json(
                    ResponseFormatter.error(
                        validation.errors[0],
                        'CARD_VALIDATION_FAILED',
                        {
                            allErrors: validation.errors,
                            warnings: validation.warnings,
                            cardInfo: validation.cardInfo
                        }
                    )
                );
            }

            return res.json(
                ResponseFormatter.success({
                    isValid: true,
                    cardInfo: validation.cardInfo,
                    message: `${validation.cardInfo.bank} kartınız doğrulandı`
                })
            );

        } catch (error) {
            console.error('[CardValidation] Validation error:', error);
            return res.status(500).json(
                ResponseFormatter.error('Kart doğrulama hatası', 'VALIDATION_ERROR')
            );
        }
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
}

module.exports = new CardValidationController();
