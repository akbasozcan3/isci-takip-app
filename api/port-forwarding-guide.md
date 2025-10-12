# 🔧 Router Port Forwarding Rehberi

## 1. 🎯 Router'a Giriş

### Adım 1: Router Adresini Bul
```bash
# Windows'ta:
ipconfig | findstr "Default Gateway"
# Sonuç: 192.168.1.1 (genellikle)
```

### Adım 2: Tarayıcıda Aç
1. **Tarayıcıda** `192.168.1.1` yazın
2. **Enter** tuşuna basın
3. **Kullanıcı adı/şifre** girin

### Adım 3: Giriş Bilgileri
**Genellikle router'ın altında yazıyor:**
- **Kullanıcı adı:** `admin`
- **Şifre:** `admin` veya `1234` veya `password`

**Veya router'ın altındaki etiketi kontrol edin**

## 2. 🔍 Port Forwarding Bulma

### TP-Link Router:
1. **"Advanced"** → **"NAT Forwarding"** → **"Port Forwarding"**
2. **"Add"** butonuna tıklayın

### Netgear Router:
1. **"Advanced"** → **"Port Forwarding"**
2. **"Add Custom Service"** tıklayın

### Asus Router:
1. **"Advanced"** → **"WAN"** → **"Virtual Server"**
2. **"Add Profile"** tıklayın

### D-Link Router:
1. **"Advanced"** → **"Port Forwarding"**
2. **"Add Rule"** tıklayın

## 3. ⚙️ Port Forwarding Ayarları

### Yeni Kural Ekle:
```
Service Name: İşçi Takip API
External Port: 4000
Internal Port: 4000
Internal IP: 192.168.1.95
Protocol: TCP
Status: Enabled
```

### Adım Adım:
1. **Service Name:** `İşçi Takip API`
2. **External Port:** `4000`
3. **Internal Port:** `4000`
4. **Internal IP:** `192.168.1.95` (bilgisayarınızın IP'si)
5. **Protocol:** `TCP`
6. **Status:** `Enabled`
7. **Save/Apply** tıklayın

## 4. 🧪 Test

### Port Forwarding Test:
```bash
# Terminal'de:
telnet 192.168.1.1 4000
# Bağlantı başarılıysa port forwarding çalışıyor
```

### API Test:
```bash
# DuckDNS domain test:
curl http://isci-takip.duckdns.org:4000/health
```

## 5. ❌ Sorun Giderme

### Port Forwarding Çalışmıyorsa:
1. **Router'ı yeniden başlatın**
2. **Firewall'ı kontrol edin**
3. **Farklı port deneyin** (4001, 8080)
4. **UPnP'yi etkinleştirin**

### Alternatif Çözüm:
**Cloudflare Tunnel kullanın** - Router ayarı gerekmez!

## 6. 🚀 Cloudflare Tunnel (Alternatif)

Router ayarları karmaşık geliyorsa:
1. **Cloudflare Tunnel indir**
2. **Tunnel oluştur**
3. **Domain al:** `isci-takip.trycloudflare.com`
4. **Router ayarı gerekmez!**
