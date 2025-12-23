-- Articles table for blog system
CREATE TABLE IF NOT EXISTS articles (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    read_time VARCHAR(50) DEFAULT '5 dk',
    category VARCHAR(100),
    tags TEXT[], -- PostgreSQL array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hero VARCHAR(500),
    views INTEGER DEFAULT 0,
    featured BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(featured);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);

-- Insert sample articles
INSERT INTO articles (id, title, excerpt, content, category, tags, featured, hero) VALUES
('art-001', 
 'Bavaxe ile İşletmenizi Dijitalleştirin', 
 'Modern iş dünyasında dijital dönüşüm artık bir lüks değil, zorunluluk. Bavaxe ile işletmenizi nasıl dijitalleştirebileceğinizi keşfedin.',
 '# Dijital Dönüşüm Nedir?

Dijital dönüşüm, işletmelerin teknoloji kullanarak operasyonlarını, süreçlerini ve müşteri deneyimlerini iyileştirmesidir.

## Bavaxe''nin Sunduğu Avantajlar

- **Gerçek Zamanlı Takip**: Ekibinizin konumunu anlık olarak izleyin
- **Veri Analizi**: Detaylı raporlar ve analizler
- **Güvenlik**: Şifreli veri iletimi ve güvenli depolama
- **Kolay Kullanım**: Kullanıcı dostu arayüz

## Başlarken

Bavaxe ile başlamak çok kolay. Sadece kayıt olun ve ekibinizi eklemeye başlayın.',
 'İş Dünyası',
 ARRAY['dijitalleşme', 'iş', 'teknoloji'],
 true,
 'blog-hero-1'),

('art-002',
 'Konum Takibi ile Verimlilik Artışı',
 'Konum takibi sadece izleme değil, aynı zamanda verimliliği artırmanın en etkili yollarından biri.',
 '# Verimlilik ve Konum Takibi

Konum takibi, işletmelerin operasyonel verimliliğini artırmak için güçlü bir araçtır.

## Faydaları

- Rota optimizasyonu
- Zaman yönetimi
- Maliyet tasarrufu
- Müşteri memnuniyeti

## Uygulama Alanları

### Lojistik
Teslimat rotalarını optimize edin.

### Saha Hizmetleri
Teknisyenlerin konumunu takip edin.

### Satış Ekipleri
Saha satış ekiplerinin performansını ölçün.',
 'Verimlilik',
 ARRAY['verimlilik', 'konum', 'takip'],
 true,
 'blog-hero-2'),

('art-003',
 'Veri Güvenliği ve Gizlilik',
 'Bavaxe, verilerinizin güvenliğini en üst düzeyde tutar. KVKK uyumlu altyapımız ile verileriniz güvende.',
 '# Veri Güvenliği Önceliğimiz

Bavaxe''de veri güvenliği ve gizlilik en önemli önceliğimizdir.

## Güvenlik Önlemleri

- **Şifreleme**: Tüm veriler AES-256 ile şifrelenir
- **KVKK Uyumu**: Türk veri koruma yasalarına tam uyum
- **Erişim Kontrolü**: Rol tabanlı erişim yönetimi
- **Yedekleme**: Otomatik günlük yedekler

## Sertifikalar

- ISO 27001
- KVKK Uyumluluk
- SSL/TLS Sertifikaları',
 'Güvenlik',
 ARRAY['güvenlik', 'gizlilik', 'kvkk'],
 false,
 NULL)
ON CONFLICT (id) DO NOTHING;
