# 🛒 Shopier Ürün Oluşturma Rehberi

Backend plan bilgilerine göre Shopier'de ürün oluşturma adımları.

---

## 📋 Backend Plan Bilgileri

### Plus Planı
- **Fiyat:** 600 TL
- **Açıklama:** Profesyoneller için gelişmiş özellikler
- **Özellikler:**
  - Öncelikli destek
  - 5 çalışma alanı
  - Gerçek zamanlı takip
  - Gelişmiş raporlama
  - 90 günlük veri saklama
  - 200 istek/dakika
  - 50 aktivite limiti
  - 2000 konum geçmişi

### Business Planı
- **Fiyat:** 1500 TL
- **Açıklama:** Kurumsal düzey güvenlik ve yönetim
- **Özellikler:**
  - Sınırsız çalışma alanı
  - Takım rol yönetimi
  - Kurumsal güvenlik raporları
  - Özel müşteri yöneticisi
  - API erişimi
  - Sınırsız veri saklama
  - 500 istek/dakika
  - 200 aktivite limiti
  - 10000 konum geçmişi
  - Sınırsız export

---

## 🎯 ÜRÜN 1: Plus Planı

### ÜRÜN GÖRSELİ YÜKLEYİN
- **Görsel:** `Nexora (2).png` dosyanızı yükleyin veya uygun bir görsel seçin
- **Boyut:** 800x800 px veya 1200x1200 px (kare format önerilir)

### ÜRÜN DETAYLARINI GİRİN

#### ÜRÜN ADI
```
Bavaxe Plus Planı - Aylık Abonelik
```

#### ÜRÜN AÇIKLAMASI
```
Bavaxe Plus Planı - Profesyoneller için gelişmiş özellikler

✅ Öncelikli destek
✅ 5 çalışma alanı
✅ Gerçek zamanlı takip
✅ Gelişmiş raporlama
✅ 90 günlük veri saklama
✅ 200 istek/dakika
✅ 50 aktivite limiti
✅ 2000 konum geçmişi

Bu plan, profesyonel kullanıcılar için tasarlanmış gelişmiş özellikler sunar. Aylık abonelik bazında faturalandırılır.
```

#### SATIŞ FİYATI
```
600
```

#### PARA BİRİMİ
```
TL (Türk Lirası)
```

#### STOK ADEDİ
```
9999
```
*(Sınırsız gibi göstermek için yüksek bir sayı)*

#### KATEGORİ SEÇİMİ
- **Kategori:** `Yazılım` veya `Abonelik` veya `Dijital Hizmet`
- Uygun bir kategori seçin

#### VARYASYON & OPSİYON SEÇİMİ
- Bu bölümü boş bırakabilirsiniz (tek plan, varyasyon yok)

---

## 🎯 ÜRÜN 2: Business Planı

### ÜRÜN GÖRSELİ YÜKLEYİN
- **Görsel:** `Nexora (2).png` dosyanızı yükleyin veya uygun bir görsel seçin
- **Boyut:** 800x800 px veya 1200x1200 px (kare format önerilir)

### ÜRÜN DETAYLARINI GİRİN

#### ÜRÜN ADI
```
Bavaxe Business Planı - Aylık Abonelik
```

#### ÜRÜN AÇIKLAMASI
```
Bavaxe Business Planı - Kurumsal düzey güvenlik ve yönetim

✅ Sınırsız çalışma alanı
✅ Takım rol yönetimi
✅ Kurumsal güvenlik raporları
✅ Özel müşteri yöneticisi
✅ API erişimi
✅ Sınırsız veri saklama
✅ 500 istek/dakika
✅ 200 aktivite limiti
✅ 10000 konum geçmişi
✅ Sınırsız export

Bu plan, kurumsal müşteriler için tasarlanmış en gelişmiş özellikleri sunar. Aylık abonelik bazında faturalandırılır.
```

#### SATIŞ FİYATI
```
1500
```

#### PARA BİRİMİ
```
TL (Türk Lirası)
```

#### STOK ADEDİ
```
9999
```
*(Sınırsız gibi göstermek için yüksek bir sayı)*

#### KATEGORİ SEÇİMİ
- **Kategori:** `Yazılım` veya `Abonelik` veya `Dijital Hizmet`
- Uygun bir kategori seçin

#### VARYASYON & OPSİYON SEÇİMİ
- Bu bölümü boş bırakabilirsiniz (tek plan, varyasyon yok)

---

## 📝 ÖNEMLİ NOTLAR

### 1. Her Plan İçin Ayrı Ürün
- Plus Planı için bir ürün
- Business Planı için ayrı bir ürün
- **Toplam 2 ürün oluşturmanız gerekiyor**

### 2. Ürün Linklerini Kaydedin
Ürün oluşturduktan sonra:
- Ürün linkini kopyalayın (örn: `shopier.com/bavax/42053585`)
- Bu linkleri `backend/.env` dosyasına ekleyin:
  ```env
  SHOPIER_PLUS_PRODUCT_LINK=https://shopier.com/bavax/PLUS_URUN_ID
  SHOPIER_BUSINESS_PRODUCT_LINK=https://shopier.com/bavax/BUSINESS_URUN_ID
  ```

### 3. Webhook URL'ini Ayarlayın
Shopier panelinde webhook URL'ini ayarlayın:
```
https://isci-takip-app-production-0f9e.up.railway.app/api/webhook/shopier
```

### 4. Görsel Zorunlu
- Shopier'de görsel zorunlu olduğu için mutlaka bir görsel yükleyin
- `Nexora (2).png` dosyanızı kullanabilirsiniz

---

## ✅ ADIM ADIM İŞLEM

1. **Plus Planı Ürününü Oluştur**
   - Yukarıdaki Plus Planı bilgilerini kullanarak formu doldurun
   - "ÜRÜNÜ SATIŞA ÇIKAR" butonuna tıklayın
   - Ürün linkini kopyalayın

2. **Business Planı Ürününü Oluştur**
   - Yukarıdaki Business Planı bilgilerini kullanarak formu doldurun
   - "ÜRÜNÜ SATIŞA ÇIKAR" butonuna tıklayın
   - Ürün linkini kopyalayın

3. **Backend'e Linkleri Ekleyin**
   - `backend/.env` dosyasını açın
   - Shopier linklerini ekleyin

4. **Test Edin**
   - Mobil uygulamadan veya web'den plan seçin
   - Shopier ödeme sayfasına yönlendirildiğini kontrol edin

---

## 🔗 İLGİLİ DOSYALAR

- `backend/controllers/billingController.js` - Plan tanımları
- `backend/services/pricingService.js` - Fiyat bilgileri
- `backend/services/shopierService.js` - Shopier entegrasyonu
- `backend/SHOPIER_ENTEGRASYON.md` - Detaylı entegrasyon dokümantasyonu

---

**Son Güncelleme:** 2025-01-27

