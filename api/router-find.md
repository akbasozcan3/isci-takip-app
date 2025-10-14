# 🏠 Router Bulma Rehberi

## 1. 🔍 Router'ınızı Fiziksel Olarak Bulun

### Router Nasıl Görünür:
- **Küçük kutu** (genellikle siyah/beyaz)
- **Üzerinde ışıklar** yanıp söner
- **Antenleri** var (WiFi için)
- **Kablolar** bağlı (internet kablosu)

### Nerede Bulunur:
- **Duvarda** (genellikle)
- **Masa üstünde**
- **Dolap içinde**
- **Salon/oturma odasında**

## 2. 📋 Router Etiketini Kontrol Edin

### Router'ın Altındaki Etiket:
```
Model: TP-Link Archer C7
IP: 192.168.1.1
Username: admin
Password: admin
WiFi Name: TP-Link_XXXX
WiFi Password: 12345678
```

### Önemli Bilgiler:
- **IP Adresi:** `192.168.1.1` (genellikle)
- **Kullanıcı Adı:** `admin`
- **Şifre:** `admin` veya `1234`

## 3. 🌐 Router Admin Paneline Giriş

### Adım 1: Tarayıcıda Aç
1. **Chrome/Firefox** açın
2. **Adres çubuğuna** yazın: `192.168.1.1`
3. **Enter** tuşuna basın

### Adım 2: Giriş Yapın
1. **Kullanıcı adı:** `admin`
2. **Şifre:** `admin` veya `1234`
3. **Login** tıklayın

### Adım 3: Port Forwarding Bulun
**Farklı router'larda farklı isimler:**

#### TP-Link:
- **"Advanced"** → **"NAT Forwarding"** → **"Port Forwarding"**

#### Netgear:
- **"Advanced"** → **"Port Forwarding"**

#### Asus:
- **"Advanced"** → **"WAN"** → **"Virtual Server"**

#### D-Link:
- **"Advanced"** → **"Port Forwarding"**

## 4. ⚙️ Port Forwarding Ayarları

### Yeni Kural Ekle:
```
Service Name: İşçi Takip API
External Port: 4000
Internal Port: 4000
Internal IP: 192.168.1.95
Protocol: TCP
Status: Enabled
```

## 5. 🚀 Alternatif: Cloudflare Tunnel

### Router Ayarları Karmaşık Geliyorsa:
1. **Cloudflare Tunnel indir**
2. **Tunnel oluştur**
3. **Domain al:** `isci-takip.trycloudflare.com`
4. **Router ayarı gerekmez!**

### Avantajları:
- ✅ **Router ayarı gerekmez**
- ✅ **5 dakikada kurulum**
- ✅ **HTTPS otomatik**
- ✅ **Daha güvenilir**

## 6. 📞 Yardım

### Router Bulamıyorsanız:
1. **Aile üyelerine** sorun
2. **İnternet sağlayıcınızı** arayın
3. **Cloudflare Tunnel** kullanın (daha kolay)

### Router Markası Bilinmiyorsa:
- **Etiketi** kontrol edin
- **Model numarası** yazıyor
- **Google'da** arayın
