/**
 * Pages Controller
 * Handles static page content for Product, Company, Resources, and Legal pages
 */

const ResponseFormatter = require('../core/utils/responseFormatter');

class PagesController {
  /**
   * Get Product page data
   * GET /app/pages/product
   */
  async getProductPage(req, res) {
    try {
      const productData = {
        title: 'Ürün Özellikleri',
        description: 'Bavaxe GPS takip platformunun tüm güçlü özelliklerini keşfedin',
        features: [
          {
            title: 'Gerçek Zamanlı İzleme',
            description: 'Araçlarınızı anlık olarak haritada izleyin ve konum güncellemelerini takip edin',
            icon: 'location',
          },
          {
            title: 'İş Yönetimi',
            description: 'Görevleri atayın, sürücüleri yönetin ve iş akışını optimize edin',
            icon: 'briefcase',
          },
          {
            title: 'Analitikler & Raporlar',
            description: 'Detaylı raporlar ve analytics ile performansı ölçün',
            icon: 'bar-chart',
          },
          {
            title: 'Entegrasyonlar',
            description: 'API ve webhook aracılığıyla mevcut sistemlerinizle entegre olun',
            icon: 'link',
          },
          {
            title: 'Mobil Uygulama',
            description: 'iOS ve Android için tam özellikli mobil takip uygulaması',
            icon: 'phone-portrait',
          },
          {
            title: 'Güvenlik',
            description: 'Kurumsal düzeyde şifreleme ve veri koruması',
            icon: 'shield-checkmark',
          },
        ],
        benefits: [
          {
            title: 'Operasyonel Verimlilik',
            description: 'Rota optimizasyonu ve araç yönetimi ile maliyetleri azaltın',
          },
          {
            title: 'Müşteri Memnuniyeti',
            description: 'Gerçek zamanlı izleme ile müşteri güvenini artırın',
          },
          {
            title: 'Veri Güvenliği',
            description: 'Kurumsal standartlarda veri koruması ve gizliliği',
          },
          {
            title: '24/7 Destek',
            description: 'Kapsamlı teknik destek ve danışmanlık hizmeti',
          },
        ],
      };

      return res.json(ResponseFormatter.success(productData, 'Ürün sayfası başarıyla yüklendi'));
    } catch (error) {
      console.error('[PagesController] Error in getProductPage:', error);
      return res.status(500).json(ResponseFormatter.error('Ürün sayfası yüklenemedi'));
    }
  }

  /**
   * Get Company page data
   * GET /app/pages/company
   */
  async getCompanyPage(req, res) {
    try {
      const companyData = {
        title: 'Hakkımızda',
        description: 'Bavaxe, GPS takip ve iş yönetim alanında lider bir platformdur',
        mission: 'İşletmelerin operasyonel verimliliğini maksimize etmek ve müşteri memnuniyetini artırmak için yenilikçi teknoloji çözümleri sunmak.',
        vision: '2030 yılında, GPS takip ve iş yönetim kategorisinde dünyanın en güvenilir ve kullanıcı dostu platformu olmak.',
        values: [
          {
            title: 'İnnovasyon',
            description: 'Sürekli teknoloji geliştirme ve iyileştirme ile sektörde öncü olmak',
            icon: 'bulb',
          },
          {
            title: 'Güvenilirlik',
            description: 'Müşteri verilerini korumak ve hizmet kalitesini garantilemek',
            icon: 'shield-checkmark',
          },
          {
            title: 'Müşteri Odaklılık',
            description: 'Müşteri ihtiyaçlarını anlamak ve en iyi çözümleri sunmak',
            icon: 'heart',
          },
          {
            title: 'Takım Çalışması',
            description: 'Diverse ve yetenekli ekipler ile başarı elde etmek',
            icon: 'people',
          },
        ],
        team: [
          {
            name: 'Özcan Yılmaz',
            role: 'Kurucu & CEO',
            bio: 'GPS teknolojisi ve iş yönetimi alanında 10+ yıl deneyim',
          },
          {
            name: 'Teknoloji Ekibi',
            role: 'Geliştirme Ekibi',
            bio: 'Deneyimli yazılım mühendisleri ve mimarlar',
          },
        ],
      };

      return res.json(ResponseFormatter.success(companyData, 'Şirket sayfası başarıyla yüklendi'));
    } catch (error) {
      console.error('[PagesController] Error in getCompanyPage:', error);
      return res.status(500).json(ResponseFormatter.error('Şirket sayfası yüklenemedi'));
    }
  }

  /**
   * Get Resources page data
   * GET /app/pages/resources
   */
  async getResourcesPage(req, res) {
    try {
      const resourcesData = {
        title: 'Kaynaklar',
        description: 'Bavaxe\'i en iyi şekilde kullanmak için tüm kaynaklara erişin',
        categories: {
          dokumantasyon: [
            {
              title: 'API Dokümantasyonu',
              description: 'Bavaxe API\'sini entegre etmek için detaylı teknik dokümanlar',
              category: 'Dokümantasyon',
              icon: 'document-text',
              link: '/blog?category=Teknoloji',
            },
            {
              title: 'Kullanıcı Rehberi',
              description: 'Adım adım uygulama kullanım talimatları',
              category: 'Dokümantasyon',
              icon: 'book',
              link: '/blog?category=Kullanım',
            },
            {
              title: 'API Referansı',
              description: 'Tüm endpoint\'lerin detaylı açıklamaları ve örnekleri',
              category: 'Dokümantasyon',
              icon: 'code-slash',
              link: '/blog?category=Teknoloji',
            },
          ],
          ogrenim: [
            {
              title: 'Video Eğitimler',
              description: 'Bavaxe platformunun tüm özelliklerini öğren',
              category: 'Öğrenim',
              icon: 'play-circle',
              link: '/blog?category=Eğitim',
            },
            {
              title: 'Webinar Serisi',
              description: 'Uzmanlar tarafından sunulan canlı eğitim oturumları',
              category: 'Öğrenim',
              icon: 'videocam',
              link: '/blog?category=Eğitim',
            },
            {
              title: 'Sertifikasyon Programı',
              description: 'Bavaxe uzmanı olmak için eğitim sertifikaları',
              category: 'Öğrenim',
              icon: 'medal',
              link: '/blog?category=Eğitim',
            },
          ],
          destek: [
            {
              title: 'Yardım Merkezi',
              description: 'Sık sorulan sorular ve sorun çözüm rehberleri',
              category: 'Destek',
              icon: 'help-circle',
              link: '/help',
            },
            {
              title: 'Topluluğumuz',
              description: 'Kullanıcı forumu ve topluluk desteği',
              category: 'Destek',
              icon: 'people-circle',
              link: '/help',
            },
            {
              title: '24/7 Teknik Destek',
              description: 'Teknik sorunlar için canlı destek',
              category: 'Destek',
              icon: 'headset',
              link: '/(tabs)/profile',
            },
          ],
          entegrasyon: [
            {
              title: 'Webhook Rehberi',
              description: 'Real-time event\'ler için webhook entegrasyonu',
              category: 'Entegrasyon',
              icon: 'git-network',
              link: '/blog?category=Teknoloji',
            },
            {
              title: 'SDK\'lar',
              description: 'Python, JavaScript, Go ve diğer dillerde SDK\'lar',
              category: 'Entegrasyon',
              icon: 'layers',
              link: '/blog?category=Teknoloji',
            },
            {
              title: 'Üçüncü Parti Entegrasyonları',
              description: 'Popüler servislerin entegrasyon rehberleri',
              category: 'Entegrasyon',
              icon: 'plug',
              link: '/blog?category=Teknoloji',
            },
          ],
        },
      };

      return res.json(ResponseFormatter.success(resourcesData, 'Kaynaklar sayfası başarıyla yüklendi'));
    } catch (error) {
      console.error('[PagesController] Error in getResourcesPage:', error);
      return res.status(500).json(ResponseFormatter.error('Kaynaklar sayfası yüklenemedi'));
    }
  }

  /**
   * Get Legal page data
   * GET /app/pages/legal
   */
  async getLegalPage(req, res) {
    try {
      const legalData = {
        title: 'Yasal Belgeler',
        description: 'Bavaxe hizmetlerinin yasal şartları ve gizlilik politikası',
        sections: [
          {
            title: 'Gizlilik Politikası',
            lastUpdated: '2024-01-15',
            content: `Bavaxe, kullanıcı gizliliğini çok ciddiye alır. Bu gizlilik politikası, kişisel verilerin nasıl toplandığını, kullanıldığını ve korunduğunu açıklar.

1. TOPLANAN VERİLER
- Kişisel kimlik bilgileri (ad, e-posta, telefon)
- Lokasyon verileri (GPS konumu)
- Cihaz bilgileri (cihaz ID, işletim sistemi)
- Kullanım istatistikleri ve log dosyaları

2. VERİLERİN KULLANIMI
- Hizmet sağlama ve iyileştirme
- Teknik destek ve müşteri hizmetleri
- Güvenlik ve dolandırıcılık önleme
- Yasal yükümlülüklerin yerine getirilmesi

3. VERİLERİN KORUNMASI
Verileri korumak için endüstri standardı şifrelemesi kullanıyoruz. Veriler yetkisiz erişime karşı korunur.

4. HAKLARINIZ
- Verilerinize erişim hakkı
- Verileri düzeltme hakkı
- Verileri silme hakkı
- İtiraz etme hakkı`,
          },
          {
            title: 'Kullanım Şartları',
            lastUpdated: '2024-01-15',
            content: `Bu kullanım şartları, Bavaxe hizmetlerinin kullanımına ilişkin şartları ve koşulları tanımlar.

1. HIZMET KULLANIMI
Bavaxe hizmetlerini yalnızca yasal amaçlar için kullanabilirsiniz. Herhangi bir yasa ihlali veya kötüye kullanım yapmanız yasaktır.

2. KULLANICI HESABI
Hesap oluşturma sırasında sağladığınız bilgilerin doğru ve güncel olmasından sorumlusunuz.

3. FIKRI MÜLKIYET
Bavaxe içeriği, tasarım ve işlevselliği telif hakkı tarafından korunur. Yazılı izin olmadan çoğaltılamaz.

4. SORUMLULUK SINIRI
Bavaxe, hizmetlerin kesintisiz veya hatasız olacağını garanti etmez. Herhangi bir zarardan sorumlu değildir.

5. KOŞULLARı DEĞİŞİKLİK
Bu şartları önceden haber vererek değiştirme hakkını saklı tutarız.`,
          },
          {
            title: 'KVKK Uyumluluğu',
            lastUpdated: '2024-01-15',
            content: `Bavaxe, Türkiye\'nin Kişisel Verilerin Korunması Kanunu (KVKK) ile tam olarak uyumludur.

1. VERİ SORUMLUSU
Bavaxe A.Ş., kişisel verilerin işlenmesinden sorumludur.

2. İŞLEME AMAÇLARI
Veriler şu amaçlarla işlenir:
- Hizmet sağlama
- Teknik süreçler
- Pazarlama (rıza ile)
- Yasal yükümlülükler

3. RIZA VE HAK
Belirli veri işlemeleri için açık rızanız alınır. Haklarınız konusunda başvuru yapabilirsiniz.

4. VERI TRANSFER
Uluslararası veri transferleri KVKK\'nın 5. maddesi gereğince yapılır.

5. İLETİŞİM
Veri hakları hakkında: bilgi@bavaxe.com`,
          },
          {
            title: 'Çerez Politikası',
            lastUpdated: '2024-01-15',
            content: `Bavaxe, kullanıcı deneyimini geliştirmek için çerezleri kullanır.

1. ÇEREZLERİN TÜRÜ
- Gerekli çerezler: Hizmeti sağlamak için
- Analitik çerezleri: Kullanımı anlamak için
- Pazarlama çerezleri: Reklam için (rıza ile)

2. ÇEREZLERİ KONTROL ETME
Tarayıcı ayarlarında çerezleri devre dışı bırakabilirsiniz, ancak bazı özellikleri etkileyebilir.

3. ÜÇÜNCÜ TARAF
Google Analytics gibi hizmetler çerez kullanabilir.

4. GÜNCELLEME
Politika herhangi bir zamanda güncellenebilir.`,
          },
        ],
      };

      return res.json(ResponseFormatter.success(legalData, 'Yasal sayfası başarıyla yüklendi'));
    } catch (error) {
      console.error('[PagesController] Error in getLegalPage:', error);
      return res.status(500).json(ResponseFormatter.error('Yasal sayfası yüklenemedi'));
    }
  }

  /**
   * Get all pages config for Footer
   * GET /app/config
   */
  async getAppConfig(req, res) {
    try {
      const config = {
        footer: {
          tagline: 'Profesyonel GPS Takip ve İş Yönetim Platformu',
          copyright: `© ${new Date().getFullYear()} Bavaxe. Tüm hakları saklıdır.`,
          socialLinks: [
            { platform: 'twitter', url: 'https://twitter.com/bavaxe', label: 'Twitter' },
            { platform: 'linkedin', url: 'https://linkedin.com/company/bavaxe', label: 'LinkedIn' },
            { platform: 'github', url: 'https://github.com/bavaxe', label: 'GitHub' },
            { platform: 'email', url: 'mailto:support@bavaxe.com', label: 'Email' },
          ],
          links: {
            product: [
              { label: 'Özellikler', href: '/product' },
              { label: 'Fiyatlandırma', href: '/upgrade' },
              { label: 'Güvenlik', href: '/product' },
              { label: 'API', href: '/product' },
            ],
            company: [
              { label: 'Hakkımızda', href: '/company' },
              { label: 'Blog', href: '/blog' },
              { label: 'Kariyer', href: '/company' },
              { label: 'İletişim', href: '/company' },
            ],
            resources: [
              { label: 'Dokümantasyon', href: '/resources' },
              { label: 'Rehberler', href: '/resources' },
              { label: 'API Referansı', href: '/resources' },
              { label: 'Yardım Merkezi', href: '/resources' },
            ],
            legal: [
              { label: 'Gizlilik Politikası', href: '/legal' },
              { label: 'Kullanım Şartları', href: '/legal' },
              { label: 'KVKK', href: '/legal' },
              { label: 'Çerez Politikası', href: '/legal' },
            ],
          },
        },
      };

      return res.json(ResponseFormatter.success(config, 'Uygulama konfigürasyonu başarıyla yüklendi'));
    } catch (error) {
      console.error('[PagesController] Error in getAppConfig:', error);
      return res.status(500).json(ResponseFormatter.error('Uygulama konfigürasyonu yüklenemedi'));
    }
  }
}

module.exports = new PagesController();
