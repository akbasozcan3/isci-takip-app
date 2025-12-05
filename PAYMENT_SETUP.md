# Ödeme Sistemi Kurulum Rehberi

## 1. iyzico (Türkiye Ödeme)

### Web Sitesi
**https://www.iyzico.com**

### API Key Alma Adımları

1. **Hesap Oluşturma:**
   - https://www.iyzico.com adresine gidin
   - "Kayıt Ol" butonuna tıklayın
   - Şirket bilgilerinizi girin ve hesap oluşturun

2. **Sandbox (Test) API Key'leri:**
   - https://sandbox-merchant.iyzipay.com adresine gidin
   - Test hesabı oluşturun veya giriş yapın
   - "Ayarlar" → "API Bilgileri" bölümüne gidin
   - **API Key** kopyalayın
   - **Secret Key** kopyalayın

3. **Production API Key'leri:**
   - https://merchant.iyzipay.com adresine gidin
   - Üyelik işlemlerini tamamlayın
   - "Ayarlar" → "API Bilgileri" bölümüne gidin
   - **API Key** kopyalayın
   - **Secret Key** kopyalayın

4. **Environment Variables (.env dosyasına ekleyin):**
```env
IYZICO_API_KEY=YOUR_IYZICO_API_KEY_HERE
IYZICO_SECRET_KEY=YOUR_IYZICO_SECRET_KEY_HERE
IYZICO_BASE_URL=https://api.iyzipay.com
```

### Test Kartları (iyzico Sandbox)
- Başarılı ödeme: `5528 7900 0000 0000`
- Kart reddedildi: `5528 7900 0000 0001`
- Yetersiz bakiye: `5528 7900 0000 0002`
- CVV: Herhangi bir 3 haneli sayı
- Son kullanma: Gelecek bir tarih (örn: 12/25)

---

## 2. Hızlı Kurulum

### Backend .env Dosyasına Ekleme

1. `backend/.env` dosyasını açın (yoksa oluşturun)

2. Aşağıdaki değerleri ekleyin:

```env
# iyzico (Sandbox Mode)
IYZICO_API_KEY=YOUR_IYZICO_API_KEY
IYZICO_SECRET_KEY=YOUR_IYZICO_SECRET_KEY
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com

# Callback URL'leri
IYZICO_CALLBACK_URL=http://localhost:4000/api/payment/callback
IYZICO_WEBHOOK_URL=http://localhost:4000/api/webhook/payment
```

3. Backend'i yeniden başlatın:
```bash
cd backend
npm start
# veya
pm2 restart all
```

---

## 3. Ödeme Gateway Seçimi

Sistem otomatik olarak şu sırayla gateway seçer:

1. **iyzico** (eğer geçerli key varsa)
2. **Mock** (test modu - gerçek para çekilmez)

Gateway yoksa veya geçersizse, sistem otomatik olarak **mock mod**a geçer.

---

## 4. Önemli Notlar

### Güvenlik
- ❌ API key'leri asla GitHub'a commit etmeyin
- ✅ `.env` dosyasını `.gitignore`'a ekleyin
- ✅ Production'da environment variables kullanın

### Test vs Production
- **Test/Sandbox:** Gerçek para çekilmez, test kartları kullanılır
- **Production:** Gerçek para çekilir, gerçek kartlar kullanılır

### Destek
- **iyzico:** https://dev.iyzipay.com/tr

