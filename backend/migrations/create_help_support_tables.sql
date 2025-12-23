-- FAQ Table
CREATE TABLE IF NOT EXISTS faqs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  `order` INT DEFAULT 0,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_order (`order`),
  INDEX idx_active (isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  userId INT NULL,
  status ENUM('new', 'read', 'replied') DEFAULT 'new',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_user (userId),
  INDEX idx_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('bug', 'feature', 'improvement', 'other') NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  userId INT NULL,
  status ENUM('new', 'reviewing', 'planned', 'completed', 'rejected') DEFAULT 'new',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_user (userId),
  INDEX idx_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample FAQs
INSERT INTO faqs (category, question, answer, `order`) VALUES
('Genel', 'Bavaxe nedir?', 'Bavaxe, modern ve güvenli bir konum takip sistemidir. Ekip üyelerinizin konumlarını gerçek zamanlı olarak takip edebilir, detaylı raporlar alabilir ve iş süreçlerinizi optimize edebilirsiniz.', 1),
('Genel', 'Bavaxe nasıl çalışır?', 'Bavaxe, mobil uygulama üzerinden çalışanlarınızın konum bilgilerini toplar ve merkezi bir panelde görüntüler. Tüm veriler şifrelenmiş olarak saklanır ve sadece yetkili kişiler tarafından görüntülenebilir.', 2),
('Hesap', 'Nasıl kayıt olabilirim?', 'Bavaxe uygulamasını indirdikten sonra "Kayıt Ol" butonuna tıklayarak e-posta adresiniz ile kayıt olabilirsiniz. Kayıt işlemi tamamlandıktan sonra hemen kullanmaya başlayabilirsiniz.', 1),
('Hesap', 'Şifremi unuttum, ne yapmalıyım?', 'Giriş ekranında "Şifremi Unuttum" linkine tıklayarak şifre sıfırlama işlemini başlatabilirsiniz. E-posta adresinize gönderilen link ile yeni şifrenizi belirleyebilirsiniz.', 2),
('Konum Takibi', 'Konum takibi nasıl başlatılır?', 'Uygulama açıldığında otomatik olarak konum takibi başlar. Konum paylaşımını durdurmak isterseniz ayarlar menüsünden kapatabilirsiniz.', 1),
('Konum Takibi', 'Konum bilgilerim ne kadar süre saklanır?', 'Konum geçmişiniz varsayılan olarak 30 gün boyunca saklanır. Premium üyelikle bu süreyi 90 güne kadar uzatabilirsiniz.', 2),
('Abonelik', 'Premium üyelik avantajları nelerdir?', 'Premium üyelikle sınırsız grup oluşturma, detaylı raporlar, 90 günlük geçmiş, öncelikli destek ve reklamsız deneyim gibi avantajlardan yararlanabilirsiniz.', 1),
('Abonelik', 'Üyeliğimi nasıl iptal edebilirim?', 'Profil > Abonelik > Aboneliği İptal Et yolunu izleyerek üyeliğinizi istediğiniz zaman iptal edebilirsiniz. İptal sonrası mevcut dönem sonuna kadar premium özelliklerden yararlanmaya devam edersiniz.', 2),
('Güvenlik', 'Verilerim güvende mi?', 'Evet, tüm verileriniz end-to-end şifreleme ile korunmaktadır. Konum bilgileriniz sadece sizin ve yetkilendirdiğiniz kişiler tarafından görüntülenebilir.', 1),
('Güvenlik', 'Konum paylaşımını kimlerle yapabilirim?', 'Konum paylaşımını sadece oluşturduğunuz gruplardaki üyelerle yapabilirsiniz. Grup dışındaki hiç kimse konum bilgilerinize erişemez.', 2),
('Teknik', 'Uygulama hangi cihazlarda çalışır?', 'Bavaxe, iOS 13.0 ve üzeri, Android 8.0 ve üzeri sürümlerde çalışmaktadır.', 1),
('Teknik', 'İnternet bağlantısı olmadan çalışır mı?', 'Konum takibi için internet bağlantısı gereklidir. Ancak offline modda toplanan veriler internet bağlantısı sağlandığında otomatik olarak senkronize edilir.', 2);
