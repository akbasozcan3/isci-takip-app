# Video Dosyaları

Bu klasöre video dosyalarınızı yerleştirin.

## Gerekli Video Dosyası

- **hero-banner.mp4**: Ana sayfa hero section için video banner
  - Önerilen boyut: 1920x400 piksel veya 16:9 oran
  - Format: MP4 (H.264 codec önerilir)
  - Süre: 10-30 saniye (loop için)
  - Dosya boyutu: Mümkün olduğunca küçük (1-5 MB önerilir)

## Video Optimizasyonu

Video dosyanızı optimize etmek için:

1. **FFmpeg ile sıkıştırma:**
   ```bash
   ffmpeg -i input.mp4 -vcodec h264 -acodec aac -crf 23 -preset medium output.mp4
   ```

2. **Boyutlandırma:**
   ```bash
   ffmpeg -i input.mp4 -vf scale=1920:400 -c:v libx264 -crf 23 output.mp4
   ```

3. **Loop için optimize:**
   - Video başlangıcı ve sonu arasında smooth geçiş olmalı
   - 10-30 saniye arası ideal

## Dosya Yerleştirme

Video dosyasını bu klasöre `hero-banner.mp4` adıyla kaydedin:
```
app/assets/videos/hero-banner.mp4
```

Backend otomatik olarak `/api/video/hero-banner.mp4` endpoint'inden servis edecektir.

