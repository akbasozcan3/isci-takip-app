# Render İzleme Yolları (Tracking Paths) Yapılandırması

## 🎯 Amaç

Backend deployment'ını yalnızca backend dosyaları değiştiğinde tetiklemek için izleme yolları kullanın. Frontend değişiklikleri deployment'ı tetiklememeli.

## 🚀 Özel Başlatma Komutu (Custom Start Command)

Render Dashboard'da **"Özel Başlatma Komutu"** alanına şunu yaz:

```
node server.js
```

**Alternatif seçenekler:**
- `npm start` - PM2 ile başlatır (Render'da genelde gereksiz)
- `npm run start:node` - Direkt Node.js ile başlatır
- `node server.js` - **ÖNERİLEN** - En basit ve hızlı

**Not:** Render zaten process management yaptığı için PM2 kullanmaya gerek yok. Direkt `node server.js` yeterli.

---

## 📋 Render Dashboard'da Yapılandırma

1. Render Dashboard → `bavaxe-backend` service'ine git
2. **"Settings"** sekmesine tıkla
3. **"İzleme Yolları" (Tracking Paths)** bölümünü bul
4. Aşağıdaki desenleri ekle:

## ✅ Eklenecek Desenler

### Kritik Backend Dosyaları

```
**/*.js
package.json
package-lock.json
server.js
ecosystem.config.js
```

### Backend Klasörleri

```
controllers/**
services/**
routes/**
modules/**
core/**
config/**
middleware/**
```

### Microservices (Opsiyonel)

Eğer microservices değişikliklerinde de deployment istiyorsan:

```
csharp_service/**
go_service/**
java_service/**
python_service/**
php_service/**
```

### Docker ve Deployment Dosyaları

```
Dockerfile
.dockerignore
render.yaml
railway.json
```

## ❌ Hariç Tutulacak Desenler (Opsiyonel - Render otomatik ignore eder)

Aşağıdaki dosyalar zaten `.gitignore`'da olduğu için genelde ignore edilir, ama emin olmak için:

```
**/*.md
**/node_modules/**
**/.env*
**/logs/**
**/backups/**
**/__pycache__/**
**/.git/**
```

## 🔧 Örnek Yapılandırma

Render UI'da **"Desen ekle"** butonuna tıklayıp şu desenleri tek tek ekle:

1. `**/*.js` - Tüm JavaScript dosyaları
2. `package.json` - Package dosyası
3. `server.js` - Ana server dosyası
4. `controllers/**` - Tüm controller'lar
5. `services/**` - Tüm servisler
6. `routes/**` - Tüm route'lar
7. `modules/**` - Tüm modüller
8. `core/**` - Core dosyalar
9. `config/**` - Config dosyaları
10. `Dockerfile` - Docker dosyası

## 📝 Notlar

- **Root Directory:** `backend` olarak ayarlı olduğu için, tüm desenler `backend/` klasörüne göre çalışır
- **Frontend değişiklikleri:** `app/`, `components/`, `utils/` gibi klasörlerdeki değişiklikler deployment'ı tetiklemeyecek
- **Test:** Bir backend dosyası değiştirip push ettiğinde deployment tetiklenmeli, frontend dosyası değiştirdiğinde tetiklenmemeli

## 🎯 Minimal Yapılandırma (Hızlı)

Sadece en kritik desenleri eklemek istersen:

```
**/*.js
package.json
server.js
```

Bu üç desen çoğu durumda yeterli olacaktır.

## ✅ Doğrulama

1. `backend/server.js` dosyasında küçük bir değişiklik yap (örn: boşluk ekle)
2. Commit ve push yap
3. Render dashboard'da yeni deployment'ın başladığını kontrol et
4. `app/index.tsx` gibi bir frontend dosyasında değişiklik yap
5. Commit ve push yap
6. Render dashboard'da deployment'ın **tetiklenmediğini** kontrol et
