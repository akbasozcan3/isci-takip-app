# 🛒 Shopier Ödeme Entegrasyonu

Shopier ile ödeme entegrasyonu rehberi.

---

## 📋 Genel Bakış

Shopier, Türkiye'de popüler bir ödeme ve e-ticaret platformudur. Bu entegrasyon sayesinde kullanıcılarınız Shopier üzerinden güvenli bir şekilde ödeme yapabilir.

### Nasıl Çalışır?

1. **Kullanıcı plan seçer** → Mobil uygulamada veya web'de plan seçimi yapar
2. **Backend Shopier linki oluşturur** → `/api/billing/shopier/checkout` endpoint'i çağrılır
3. **Kullanıcı Shopier'e yönlendirilir** → Shopier'in ödeme sayfasına gider
4. **Ödeme yapılır** → Kullanıcı Shopier üzerinden ödeme yapar
5. **Webhook bildirimi** → Shopier ödeme sonrası backend'e webhook gönderir
6. **Abonelik aktif edilir** → Backend webhook'u işler ve aboneliği aktif eder

---

## 🔧 Kurulum

### 1. Shopier'de Ürün Oluşturma

1. **Shopier hesabınıza giriş yapın**: https://shopier.com
2. **Ürün Listeleme** sayfasına gidin
3. **Her plan için ayrı ürün oluşturun:**

   **Plus Planı için:**
   - Ürün Adı: `Bavaxe Plus Planı - Aylık Abonelik`
   - Ürün Açıklaması: `Bavaxe Plus Planı - Profesyoneller için gelişmiş özellikler`
   - Satış Fiyatı: `600` TL
   - Stok Adedi: `9999` (veya istediğiniz limit)
   - Kategori: `Yazılım` veya `Abonelik`

   **Business Planı için:**
   - Ürün Adı: `Bavaxe Business Planı - Aylık Abonelik`
   - Ürün Açıklaması: `Bavaxe Business Planı - Kurumsal düzey güvenlik ve yönetim`
   - Satış Fiyatı: `1500` TL
   - Stok Adedi: `9999`
   - Kategori: `Yazılım` veya `Abonelik`

4. **Ürünü yayınlayın** ve **ürün linkini kopyalayın**
   - Örnek: `shopier.com/bavax/42053585`

### 2. Backend Yapılandırması

`backend/.env` dosyasına Shopier ayarlarını ekleyin:

```env
# Shopier Payment Gateway
SHOPIER_PLUS_PRODUCT_LINK=https://shopier.com/bavax/PLUS_PRODUCT_ID
SHOPIER_BUSINESS_PRODUCT_LINK=https://shopier.com/bavax/BUSINESS_PRODUCT_ID

# Opsiyonel - Plan tespiti için
SHOPIER_PLUS_PRODUCT_ID=42053585
SHOPIER_BUSINESS_PRODUCT_ID=42053586

# Webhook secret (Shopier panelinden alın - güvenlik için)
SHOPIER_WEBHOOK_SECRET=your-webhook-secret-here
```

### 3. Webhook URL Yapılandırması

Shopier panelinde webhook URL'ini ayarlayın:

```
https://isci-takip-app-production-0f9e.up.railway.app/api/webhook/shopier
```

**Not:** Production URL'inizi kullanın. Local development için:
```
http://localhost:4000/api/webhook/shopier
```

---

## 🔌 API Endpoints

### 1. Shopier Checkout (Ödeme Linki Oluştur)

**Endpoint:** `POST /api/billing/shopier/checkout`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "planId": "plus"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "shopier_abc123...",
    "paymentLink": "https://shopier.com/bavax/42053585",
    "gateway": "shopier",
    "plan": {
      "id": "plus",
      "title": "Plus",
      "amount": 600,
      "currency": "TRY"
    },
    "instructions": "Bu linke tıklayarak Shopier üzerinden ödeme yapabilirsiniz..."
  }
}
```

### 2. Ödeme Durumu Kontrol

**Endpoint:** `GET /api/billing/shopier/status/:transactionId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "shopier_abc123...",
    "status": "succeeded",
    "amount": 600,
    "currency": "TRY",
    "planId": "plus"
  }
}
```

### 3. Webhook (Shopier'den Otomatik Çağrılır)

**Endpoint:** `POST /api/webhook/shopier`

**Not:** Bu endpoint Shopier tarafından otomatik çağrılır, manuel çağrı yapmanıza gerek yok.

---

## 📱 Frontend Kullanımı

### React Native / Expo Örneği

```typescript
import { authFetch } from '@/utils/auth';

async function purchaseWithShopier(planId: 'plus' | 'business') {
  try {
    // 1. Shopier ödeme linki oluştur
    const response = await authFetch('/billing/shopier/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId }),
    });

    const data = await response.json();
    
    if (data.success) {
      // 2. Kullanıcıyı Shopier sayfasına yönlendir
      const { paymentLink, transactionId } = data.data;
      
      // WebView veya Linking ile aç
      await Linking.openURL(paymentLink);
      
      // 3. Ödeme durumunu kontrol et (polling veya deep link ile)
      // Örnek: Her 5 saniyede bir kontrol et
      const checkStatus = setInterval(async () => {
        const statusRes = await authFetch(`/billing/shopier/status/${transactionId}`);
        const statusData = await statusRes.json();
        
        if (statusData.data.status === 'succeeded') {
          clearInterval(checkStatus);
          // Abonelik aktif - kullanıcıyı bilgilendir
          Alert.alert('Başarılı', 'Aboneliğiniz aktif edildi!');
        }
      }, 5000);
      
      // 10 dakika sonra kontrolü durdur
      setTimeout(() => clearInterval(checkStatus), 600000);
    }
  } catch (error) {
    console.error('Shopier ödeme hatası:', error);
    Alert.alert('Hata', 'Ödeme işlemi başlatılamadı');
  }
}
```

### Web Örneği

```javascript
async function purchaseWithShopier(planId) {
  try {
    const response = await fetch('/api/billing/shopier/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId }),
    });

    const data = await response.json();
    
    if (data.success) {
      // Yeni pencerede Shopier sayfasını aç
      window.open(data.data.paymentLink, '_blank');
      
      // Ödeme durumunu kontrol et
      // ...
    }
  } catch (error) {
    console.error('Shopier ödeme hatası:', error);
  }
}
```

---

## 🔒 Güvenlik

### Webhook Doğrulama

Shopier webhook'larını doğrulamak için `SHOPIER_WEBHOOK_SECRET` kullanılır. Bu secret'i Shopier panelinden alın ve `.env` dosyasına ekleyin.

### Transaction ID

Her ödeme için benzersiz bir `transactionId` oluşturulur. Bu ID webhook'ta kullanılarak ödeme eşleştirmesi yapılır.

---

## 🐛 Sorun Giderme

### Webhook Gelmiyor

1. **Shopier panelinde webhook URL'ini kontrol edin**
2. **Backend loglarını kontrol edin:** `pm2 logs isci-takip-api`
3. **Firewall/Network ayarlarını kontrol edin**
4. **HTTPS kullanıldığından emin olun** (production için)

### Ödeme Başarılı Ama Abonelik Aktif Edilmedi

1. **Webhook'un başarıyla işlendiğini kontrol edin**
2. **Transaction'ın database'de olduğunu kontrol edin**
3. **Subscription service loglarını kontrol edin**

### Ürün Linki Bulunamadı Hatası

1. **`.env` dosyasında `SHOPIER_PLUS_PRODUCT_LINK` ve `SHOPIER_BUSINESS_PRODUCT_LINK` değerlerini kontrol edin**
2. **Linklerin doğru formatta olduğundan emin olun:** `https://shopier.com/bavax/42053585`

---

## 📊 Test Etme

### 1. Test Ödeme Linki Oluşturma

```bash
curl -X POST http://localhost:4000/api/billing/shopier/checkout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId": "plus"}'
```

### 2. Webhook Test (Manuel)

```bash
curl -X POST http://localhost:4000/api/webhook/shopier \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "test_order_123",
    "transaction_id": "test_txn_123",
    "status": "success",
    "amount": "600.00",
    "currency": "TRY",
    "customer_email": "test@example.com",
    "ref": "shopier_test_transaction_id"
  }'
```

---

## 📝 Notlar

- Shopier webhook formatı Shopier dokümantasyonuna göre güncellenebilir
- Production'da mutlaka `SHOPIER_WEBHOOK_SECRET` kullanın
- Transaction'lar geçici olarak memory'de saklanır, production'da Redis veya database kullanın
- Her plan için ayrı Shopier ürünü oluşturmanız önerilir

---

## 🔗 İlgili Dosyalar

- `backend/services/shopierService.js` - Shopier servisi
- `backend/controllers/billingController.js` - Billing controller (Shopier metodları)
- `backend/routes/index.js` - Route tanımları

---

**Son Güncelleme:** 2025-01-27

