#!/usr/bin/env python3
"""
Email Verification Service
Sends verification codes via email using SMTP
Backend generates the code and sends it here for email delivery
"""

import os
import smtplib
import re
import sys
import json
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv(override=True)

app = Flask(__name__)
CORS(app)
SMTP_HOST = (os.getenv('SMTP_HOST', 'smtp.gmail.com') or '').strip()
SMTP_PORT = int(str(os.getenv('SMTP_PORT', 587)).strip())
SMTP_USER = (os.getenv('SMTP_USER', '') or '').strip()
SMTP_PASS = (os.getenv('SMTP_PASS', '') or '').replace(' ', '').strip()
SMTP_FROM = ((os.getenv('SMTP_FROM') or SMTP_USER) or '').strip()
SMTP_SECURE = (os.getenv('SMTP_SECURE', '') or '').strip().lower() in ['1', 'true', 'yes'] or SMTP_PORT == 465
# Logo dosyasını base64'e çevir - Mutlak yol ile
LOGO_BASE64 = None
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOGO_PATHS = [
    os.path.join(PROJECT_ROOT, 'Nexora (2).png'),
    os.path.join(PROJECT_ROOT, 'app', 'assets', 'logo', 'Nexora.png'),
    os.path.join(PROJECT_ROOT, 'app', '(tabs)', 'assets', 'logo', 'Nexora.png'),
    os.path.join(SCRIPT_DIR, '..', 'Nexora (2).png'),
    os.path.join(SCRIPT_DIR, '..', 'app', 'assets', 'logo', 'Nexora.png'),
    os.path.join(SCRIPT_DIR, '..', 'app', '(tabs)', 'assets', 'logo', 'Nexora.png'),
    os.path.join(os.getcwd(), 'Nexora (2).png'),
    os.path.join(os.getcwd(), '..', 'Nexora (2).png'),
    'Nexora (2).png',
]

logger.info(f"🔍 Searching for logo file...")
logger.info(f"   Script dir: {SCRIPT_DIR}")
logger.info(f"   Project root: {PROJECT_ROOT}")
logger.info(f"   Current dir: {os.getcwd()}")

for LOGO_PATH in LOGO_PATHS:
    abs_path = os.path.abspath(LOGO_PATH)
    logger.info(f"   Checking: {abs_path} (exists: {os.path.exists(abs_path)})")
    if os.path.exists(abs_path):
        try:
            with open(abs_path, 'rb') as f:
                logo_data = f.read()
                logo_base64 = base64.b64encode(logo_data).decode('utf-8')
                LOGO_BASE64 = f"data:image/png;base64,{logo_base64}"
                logger.info(f"✅ Logo loaded successfully from: {abs_path}")
                logger.info(f"   Logo size: {len(logo_data)} bytes, Base64 length: {len(logo_base64)} chars")
                break
        except Exception as e:
            logger.error(f"❌ Could not load logo from {abs_path}: {str(e)}")
            continue

if not LOGO_BASE64:
    logger.error("❌ Logo file not found in any location, using placeholder")
    logger.error(f"   Tried paths: {LOGO_PATHS}")

# Logo URL veya base64 kullan - Base64'e öncelik ver
BRAND_LOGO = LOGO_BASE64 or (os.getenv('EMAIL_LOGO_URL') or '').strip() or (
    "https://via.placeholder.com/200x200/06b6d4/ffffff?text=BAVAXE"
)

if LOGO_BASE64:
    logger.info(f"✅ Using base64 logo (length: {len(LOGO_BASE64)} chars)")
else:
    logger.warning(f"⚠️  Using placeholder logo: {BRAND_LOGO}")
BRAND_NAME = os.getenv('BRAND_NAME', 'Bavaxe').strip()
BRAND_COLOR_PRIMARY = os.getenv('BRAND_COLOR_PRIMARY', '#06b6d4').strip()
BRAND_COLOR_SECONDARY = os.getenv('BRAND_COLOR_SECONDARY', '#7c3aed').strip()

def send_verification_email(to_email, code):
    """Send verification code via email"""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP credentials not configured. Email sending will fail.")
        return False
    try:
        # Validate inputs
        if not to_email or not code:
            logger.error("Email or code is missing")
            return False
        
        if not re.match(r'^\d{6}$', code):
            logger.error(f"Invalid code format: {code}")
            return False
        
        # Logo kontrolü - Base64'e öncelik ver
        current_logo = LOGO_BASE64 if LOGO_BASE64 else BRAND_LOGO
        if LOGO_BASE64:
            logger.info(f"📧 Using base64 logo for email (length: {len(LOGO_BASE64)} chars)")
        else:
            logger.warning(f"⚠️  Logo not loaded, using: {current_logo[:50]}...")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'İşçi Takip - E-posta Doğrulama Kodu'
        msg['From'] = SMTP_FROM
        msg['To'] = to_email

        # Create HTML email body with professional design
        html_body = f"""
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>E-posta Doğrulama - {BRAND_NAME}</title>
            <!-- Google Fonts - Poppins -->
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
                /* Reset & Base Styles */
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                body {{ 
                    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6; 
                    color: #1f2937; 
                    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
                    padding: 20px;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    font-weight: 400;
                }}
                
                /* Email Container - Geniş Tasarım */
                .email-wrapper {{
                    max-width: 900px;
                    width: 100%;
                    margin: 0 auto;
                    background-color: #ffffff;
                }}
                
                .email-container {{
                    background-color: #ffffff;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
                    border: 1px solid rgba(6, 182, 212, 0.1);
                }}
                
                /* Header Section - Geniş Premium Design */
                .header {{
                    background: linear-gradient(135deg, {BRAND_COLOR_PRIMARY} 0%, {BRAND_COLOR_SECONDARY} 100%);
                    color: white;
                    padding: 80px 60px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }}
                
                .header::before {{
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
                    animation: pulse 4s ease-in-out infinite;
                }}
                
                .header::after {{
                    content: '';
                    position: absolute;
                    bottom: -30%;
                    left: -30%;
                    width: 150%;
                    height: 150%;
                    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
                    animation: pulse 5s ease-in-out infinite reverse;
                }}
                
                @keyframes pulse {{
                    0%, 100% {{ opacity: 0.2; transform: scale(1); }}
                    50% {{ opacity: 0.5; transform: scale(1.1); }}
                }}
                
                .header-content {{
                    position: relative;
                    z-index: 1;
                }}
                
                .header-icon {{
                    width: 160px;
                    height: 160px;
                    background: rgba(255, 255, 255, 0.25);
                    border-radius: 40px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 32px;
                    backdrop-filter: blur(20px);
                    border: 4px solid rgba(255, 255, 255, 0.5);
                    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.5), inset 0 0 30px rgba(255, 255, 255, 0.15);
                    overflow: hidden;
                    position: relative;
                }}
                
                .header-icon::before {{
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent);
                    animation: shine 3s infinite;
                }}
                
                @keyframes shine {{
                    0% {{ transform: translateX(-100%) translateY(-100%) rotate(45deg); }}
                    100% {{ transform: translateX(100%) translateY(100%) rotate(45deg); }}
                }}
                
                .header-icon img {{
                    width: 120px !important;
                    height: 120px !important;
                    max-width: 120px !important;
                    max-height: 120px !important;
                    object-fit: contain !important;
                    position: relative;
                    z-index: 1;
                    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3));
                    display: block !important;
                    margin: 0 auto;
                }}
                
                .header h1 {{
                    font-size: 48px;
                    font-weight: 900;
                    margin-bottom: 16px;
                    letter-spacing: 1px;
                    text-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                    font-family: 'Poppins', sans-serif;
                }}
                
                .header p {{
                    font-size: 20px;
                    opacity: 0.98;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    font-family: 'Poppins', sans-serif;
                }}
                
                /* Content Section - Geniş */
                .content {{
                    padding: 64px 60px;
                    background-color: #ffffff;
                }}
                
                .greeting {{
                    color: #0f172a;
                    font-size: 28px;
                    margin-bottom: 24px;
                    font-weight: 900;
                    font-family: 'Poppins', sans-serif;
                    letter-spacing: 0.5px;
                }}
                
                .instruction {{
                    color: #475569;
                    font-size: 18px;
                    margin-bottom: 48px;
                    line-height: 1.8;
                    font-weight: 500;
                    font-family: 'Poppins', sans-serif;
                }}
                
                /* Code Container - Geniş Premium Design */
                .code-container {{
                    background: linear-gradient(135deg, {BRAND_COLOR_PRIMARY} 0%, {BRAND_COLOR_SECONDARY} 100%);
                    border-radius: 32px;
                    padding: 64px 60px;
                    margin: 48px 0;
                    text-align: center;
                    box-shadow: 0 24px 60px rgba(6, 182, 212, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.15) inset;
                    position: relative;
                    overflow: hidden;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                }}
                
                .code-container::before {{
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
                    animation: rotate 8s linear infinite;
                }}
                
                @keyframes rotate {{
                    from {{ transform: rotate(0deg); }}
                    to {{ transform: rotate(360deg); }}
                }}
                
                .code-wrapper {{
                    position: relative;
                    z-index: 1;
                }}
                
                .code {{
                    color: white;
                    font-size: 72px;
                    font-weight: 900;
                    letter-spacing: 20px;
                    font-family: 'Poppins', 'Courier New', 'Monaco', monospace;
                    text-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 255, 255, 0.3);
                    margin-bottom: 24px;
                    display: inline-block;
                    padding: 24px 40px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 24px;
                    backdrop-filter: blur(16px);
                    border: 3px solid rgba(255, 255, 255, 0.35);
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3) inset;
                }}
                
                .code-label {{
                    color: rgba(255, 255, 255, 1);
                    font-size: 16px;
                    text-transform: uppercase;
                    letter-spacing: 4px;
                    font-weight: 900;
                    font-family: 'Poppins', sans-serif;
                    text-shadow: 0 3px 12px rgba(0, 0, 0, 0.3);
                }}
                
                /* Expiry Info - Geniş */
                .expiry-info {{
                    color: #334155;
                    font-size: 17px;
                    margin: 36px 0;
                    padding: 24px 32px;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border-radius: 20px;
                    border-left: 6px solid {BRAND_COLOR_PRIMARY};
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
                    font-family: 'Poppins', sans-serif;
                    font-weight: 600;
                }}
                
                .expiry-info strong {{
                    color: {BRAND_COLOR_PRIMARY};
                    font-weight: 800;
                    font-family: 'Poppins', sans-serif;
                }}
                
                /* Warning Box - Geniş Enhanced */
                .warning {{
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border: 3px solid #f59e0b;
                    border-radius: 20px;
                    padding: 28px 32px;
                    margin: 32px 0;
                    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.25);
                }}
                
                .warning-header {{
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                }}
                
                .warning-icon {{
                    font-size: 24px;
                    margin-right: 12px;
                }}
                
                .warning-title {{
                    color: #92400e;
                    font-size: 18px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }}
                
                .warning-text {{
                    color: #92400e;
                    font-size: 16px;
                    line-height: 1.7;
                    margin: 0;
                    font-weight: 600;
                }}
                
                /* Support Section */
                .support-section {{
                    margin-top: 32px;
                    padding-top: 24px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                }}
                
                .support-text {{
                    color: #6b7280;
                    font-size: 14px;
                    margin-bottom: 8px;
                }}
                
                .support-email {{
                    color: #06b6d4;
                    font-size: 15px;
                    font-weight: 700;
                    text-decoration: none;
                    display: inline-block;
                    padding: 8px 16px;
                    background: rgba(6, 182, 212, 0.1);
                    border-radius: 8px;
                    transition: all 0.3s ease;
                }}
                
                .support-email:hover {{
                    background: rgba(6, 182, 212, 0.2);
                    transform: translateY(-2px);
                }}
                
                /* Footer - Geniş */
                .footer {{
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    padding: 48px 60px;
                    text-align: center;
                    color: rgba(255, 255, 255, 0.8);
                }}
                
                .footer-brand {{
                    font-size: 28px;
                    font-weight: 900;
                    color: #fff;
                    margin-bottom: 16px;
                    letter-spacing: 3px;
                    font-family: 'Poppins', sans-serif;
                    text-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
                }}
                
                .footer p {{
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 16px;
                    margin: 12px 0;
                    line-height: 1.8;
                    font-family: 'Poppins', sans-serif;
                    font-weight: 500;
                }}
                
                .footer-links {{
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.15);
                }}
                
                .footer-links a {{
                    color: {BRAND_COLOR_PRIMARY};
                    text-decoration: none;
                    font-size: 13px;
                    margin: 0 10px;
                    font-weight: 700;
                    font-family: 'Poppins', sans-serif;
                    transition: color 0.3s ease;
                    letter-spacing: 0.5px;
                }}
                
                .footer-links a:hover {{
                    color: {BRAND_COLOR_SECONDARY};
                    text-decoration: underline;
                }}
                
                /* Responsive Design - Geniş */
                @media only screen and (max-width: 900px) {{
                    .email-wrapper {{
                        max-width: 100%;
                        padding: 0 20px;
                    }}
                    
                    body {{
                        padding: 15px;
                    }}
                    
                    .header {{
                        padding: 60px 40px;
                    }}
                    
                    .header h1 {{
                        font-size: 36px;
                    }}
                    
                    .content {{
                        padding: 48px 40px;
                    }}
                    
                    .code {{
                        font-size: 56px;
                        letter-spacing: 12px;
                        padding: 20px 32px;
                    }}
                    
                    .code-container {{
                        padding: 48px 40px;
                    }}
                    
                    .footer {{
                        padding: 40px 40px;
                    }}
                }}
                
                @media only screen and (max-width: 600px) {{
                    .header {{
                        padding: 40px 24px;
                    }}
                    
                    .header h1 {{
                        font-size: 28px;
                    }}
                    
                    .content {{
                        padding: 36px 24px;
                    }}
                    
                    .code {{
                        font-size: 42px;
                        letter-spacing: 8px;
                        padding: 16px 24px;
                    }}
                    
                    .code-container {{
                        padding: 36px 24px;
                    }}
                }}
                
                /* Dark Mode Support */
                @media (prefers-color-scheme: dark) {{
                    body {{
                        background-color: #111827;
                    }}
                    
                    .email-container {{
                        background-color: #1f2937;
                        border-color: #374151;
                    }}
                    
                    .content {{
                        background-color: #1f2937;
                    }}
                    
                    .greeting {{
                        color: #f9fafb;
                    }}
                    
                    .instruction {{
                        color: #d1d5db;
                    }}
                    
                    .expiry-info {{
                        background: #374151;
                        color: #d1d5db;
                        border-left-color: #06b6d4;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="email-wrapper">
                <div class="email-container">
                    <!-- Header -->
                    <div class="header">
                        <div class="header-content">
                            <div class="header-icon">
                                <img src="{current_logo}" alt="{BRAND_NAME} Logo" style="width: 120px !important; height: 120px !important; max-width: 120px !important; max-height: 120px !important; object-fit: contain !important; display: block !important; margin: 0 auto;" />
                            </div>
                            <h1>E-posta Doğrulama</h1>
                            <p>{BRAND_NAME} - İşçi Takip Sistemi</p>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="content">
                        <div class="greeting">Merhaba,</div>
                        <p class="instruction">
                            Hesabınızı doğrulamak için aşağıdaki doğrulama kodunu kullanın. 
                            Bu kod sadece sizin için oluşturulmuştur ve güvenliğiniz için önemlidir.
                        </p>
                        
                        <!-- Code Display -->
                        <div class="code-container">
                            <div class="code-wrapper">
                                <div class="code">{code}</div>
                                <div class="code-label">Doğrulama Kodu</div>
                            </div>
                        </div>
                        
                        <!-- Expiry Info -->
                        <div class="expiry-info">
                            ⏱️ Bu kod <strong>10 dakika</strong> süreyle geçerlidir. 
                            Süre dolduktan sonra yeni bir kod talep edebilirsiniz.
                        </div>
                        
                        <!-- Security Warning -->
                        <div class="warning">
                            <div class="warning-header">
                                <span class="warning-icon">⚠️</span>
                                <span class="warning-title">Güvenlik Uyarısı</span>
                            </div>
                            <p class="warning-text">
                                Bu kodu kimseyle paylaşmayın. {BRAND_NAME} ekibi asla sizden şifrenizi 
                                veya doğrulama kodunuzu istemez. Eğer bu işlemi siz yapmadıysanız, 
                                bu e-postayı görmezden gelebilir ve hesabınızı güvence altına alabilirsiniz.
                            </p>
                        </div>
                        
                        <!-- Support Section -->
                        <div class="support-section">
                            <p class="support-text">Sorularınız için destek ekibimizle iletişime geçin:</p>
                            <a href="mailto:destek@iscitakip.com" class="support-email">
                                📧 destek@iscitakip.com
                            </a>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="footer">
                        <div class="footer-brand">{BRAND_NAME}</div>
                        <p>© 2024 İşçi Takip Sistemi - Tüm hakları saklıdır.</p>
                        <p>Modern işletmeler için güvenli konum takip çözümü</p>
                        <div class="footer-links">
                            <a href="#">Gizlilik Politikası</a>
                            <span style="color: rgba(255,255,255,0.3);">|</span>
                            <a href="#">Kullanım Koşulları</a>
                            <span style="color: rgba(255,255,255,0.3);">|</span>
                            <a href="#">Yardım Merkezi</a>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        # Plain text version
        text_body = f"""
İşçi Takip - E-posta Doğrulama Kodu

Merhaba,

Hesabınızı doğrulamak için aşağıdaki doğrulama kodunu kullanın:

Doğrulama Kodu: {code}

Bu kod 10 dakika süreyle geçerlidir.

⚠️ Güvenlik Uyarısı: Bu kodu kimseyle paylaşmayın. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.

© 2024 İşçi Takip Sistemi - Tüm hakları saklıdır.
        """

        # Attach parts
        part1 = MIMEText(text_body, 'plain', 'utf-8')
        part2 = MIMEText(html_body, 'html', 'utf-8')
        
        msg.attach(part1)
        msg.attach(part2)

        # Send email
        logger.info(f"Attempting to send verification email to {to_email}")
        if SMTP_SECURE:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        
        logger.info(f"✅ Verification email sent successfully to {to_email}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed: {str(e)}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email: {str(e)}")
        return False

@app.route('/send-verification', methods=['POST'])
def send_verification():
    """API endpoint to send verification code"""
    try:
        data = request.get_json()
        email = data.get('email')
        code = data.get('code')  # Backend'den gelen kod
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not code:
            return jsonify({'error': 'Verification code is required'}), 400
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate code format (6 digits)
        if not re.match(r'^\d{6}$', code):
            return jsonify({'error': 'Invalid code format. Must be 6 digits.'}), 400
        
        # Check SMTP configuration
        if not SMTP_USER or not SMTP_PASS:
            logger.warning("SMTP credentials not configured")
            return jsonify({
                'error': 'Email service not configured. Please check SMTP settings.',
                'code': code if os.getenv('NODE_ENV') == 'development' else None
            }), 500
        
        # Send email
        success = send_verification_email(email, code)
        
        if success:
            logger.info(f"✅ Successfully sent verification code to {email}")
            return jsonify({
                'success': True,
                'message': 'Verification code sent successfully',
                'email': email
            })
        else:
            # In development, still return the code even if email fails
            dev_code = code if os.getenv('NODE_ENV') == 'development' else None
            logger.error(f"❌ Failed to send email to {email}")
            return jsonify({
                'error': 'Failed to send email. Please check SMTP settings.',
                'code': dev_code
            }), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in send_verification: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/send-reset-link', methods=['POST'])
def send_reset_link():
    """API endpoint to send password reset link"""
    try:
        data = request.get_json()
        email = data.get('email')
        reset_link = data.get('resetLink')
        token = data.get('token')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not reset_link:
            return jsonify({'error': 'Reset link is required'}), 400
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Check SMTP configuration
        if not SMTP_USER or not SMTP_PASS:
            logger.warning("SMTP credentials not configured")
            return jsonify({
                'error': 'Email service not configured. Please check SMTP settings.',
                'resetLink': reset_link if os.getenv('NODE_ENV') == 'development' else None
            }), 500
        
        # Logo kontrolü - Base64'e öncelik ver
        current_logo = LOGO_BASE64 if LOGO_BASE64 else BRAND_LOGO
        if LOGO_BASE64:
            logger.info(f"📧 Using base64 logo for reset email (length: {len(LOGO_BASE64)} chars)")
        else:
            logger.warning(f"⚠️  Logo not loaded, using: {current_logo[:50]}...")
        
        # Build email HTML - Professional Design with Logo
        html_body = f"""
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>Şifre Sıfırlama - {BRAND_NAME}</title>
            <!-- Google Fonts - Poppins -->
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
                /* Reset & Base Styles */
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                body {{ 
                    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6; 
                    color: #1f2937; 
                    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
                    padding: 20px;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    font-weight: 400;
                }}
                
                /* Email Container - Geniş Tasarım */
                .email-wrapper {{
                    max-width: 900px;
                    width: 100%;
                    margin: 0 auto;
                    background-color: #ffffff;
                }}
                
                .email-container {{
                    background-color: #ffffff;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
                    border: 1px solid rgba(6, 182, 212, 0.1);
                }}
                
                /* Header Section - Geniş Premium Design */
                .header {{
                    background: linear-gradient(135deg, {BRAND_COLOR_PRIMARY} 0%, {BRAND_COLOR_SECONDARY} 100%);
                    color: white;
                    padding: 80px 60px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }}
                
                .header::before {{
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
                    animation: pulse 4s ease-in-out infinite;
                }}
                
                .header::after {{
                    content: '';
                    position: absolute;
                    bottom: -30%;
                    left: -30%;
                    width: 150%;
                    height: 150%;
                    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
                    animation: pulse 5s ease-in-out infinite reverse;
                }}
                
                @keyframes pulse {{
                    0%, 100% {{ opacity: 0.2; transform: scale(1); }}
                    50% {{ opacity: 0.5; transform: scale(1.1); }}
                }}
                
                .header-content {{
                    position: relative;
                    z-index: 1;
                }}
                
                .header-icon {{
                    width: 160px;
                    height: 160px;
                    background: rgba(255, 255, 255, 0.25);
                    border-radius: 40px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 32px;
                    backdrop-filter: blur(20px);
                    border: 4px solid rgba(255, 255, 255, 0.5);
                    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.5), inset 0 0 30px rgba(255, 255, 255, 0.15);
                    overflow: hidden;
                    position: relative;
                }}
                
                .header-icon::before {{
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent);
                    animation: shine 3s infinite;
                }}
                
                @keyframes shine {{
                    0% {{ transform: translateX(-100%) translateY(-100%) rotate(45deg); }}
                    100% {{ transform: translateX(100%) translateY(100%) rotate(45deg); }}
                }}
                
                .header-icon img {{
                    width: 120px !important;
                    height: 120px !important;
                    max-width: 120px !important;
                    max-height: 120px !important;
                    object-fit: contain !important;
                    position: relative;
                    z-index: 1;
                    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3));
                    display: block !important;
                    margin: 0 auto;
                }}
                
                .header h1 {{
                    font-size: 48px;
                    font-weight: 900;
                    margin-bottom: 16px;
                    letter-spacing: 1px;
                    text-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                    font-family: 'Poppins', sans-serif;
                }}
                
                .header p {{
                    font-size: 20px;
                    opacity: 0.98;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    font-family: 'Poppins', sans-serif;
                }}
                
                /* Content Section - Geniş */
                .content {{
                    padding: 64px 60px;
                    background-color: #ffffff;
                }}
                
                .greeting {{
                    color: #0f172a;
                    font-size: 28px;
                    margin-bottom: 24px;
                    font-weight: 900;
                    font-family: 'Poppins', sans-serif;
                    letter-spacing: 0.5px;
                }}
                
                .instruction {{
                    color: #475569;
                    font-size: 18px;
                    margin-bottom: 48px;
                    line-height: 1.8;
                    font-weight: 500;
                    font-family: 'Poppins', sans-serif;
                }}
                
                /* Button Container - Premium Design */
                .button-container {{
                    text-align: center;
                    margin: 36px 0;
                }}
                
                .reset-button {{
                    display: inline-block;
                    background: linear-gradient(135deg, {BRAND_COLOR_PRIMARY} 0%, #0891b2 100%);
                    color: #ffffff !important;
                    text-decoration: none;
                    padding: 18px 40px;
                    border-radius: 16px;
                    font-weight: 800;
                    font-size: 17px;
                    letter-spacing: 0.5px;
                    box-shadow: 0 12px 32px rgba(6, 182, 212, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                    transition: all 0.3s ease;
                    font-family: 'Poppins', sans-serif;
                    text-transform: uppercase;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                }}
                
                .reset-button:hover {{
                    transform: translateY(-2px);
                    box-shadow: 0 16px 40px rgba(6, 182, 212, 0.55);
                }}
                
                /* Link Fallback */
                .link-fallback {{
                    margin-top: 24px;
                    padding: 18px 20px;
                    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
                    border-radius: 14px;
                    border-left: 5px solid {BRAND_COLOR_PRIMARY};
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                    font-family: 'Poppins', sans-serif;
                }}
                
                .link-fallback-label {{
                    color: #4b5563;
                    font-size: 13px;
                    margin-bottom: 8px;
                    font-weight: 600;
                }}
                
                .link-fallback-url {{
                    color: {BRAND_COLOR_PRIMARY};
                    font-size: 12px;
                    word-break: break-all;
                    margin: 0;
                    font-family: 'Courier New', monospace;
                    font-weight: 500;
                }}
                
                /* Warning Box - Geniş Enhanced */
                .warning {{
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border: 3px solid #f59e0b;
                    border-radius: 20px;
                    padding: 28px 32px;
                    margin: 32px 0;
                    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.25);
                }}
                
                .warning-header {{
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                }}
                
                .warning-icon {{
                    font-size: 24px;
                    margin-right: 12px;
                }}
                
                .warning-title {{
                    color: #92400e;
                    font-size: 18px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }}
                
                .warning-text {{
                    color: #92400e;
                    font-size: 16px;
                    line-height: 1.7;
                    margin: 0;
                    font-weight: 600;
                }}
                
                /* Footer - Geniş */
                .footer {{
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    padding: 48px 60px;
                    text-align: center;
                    color: rgba(255, 255, 255, 0.8);
                }}
                
                .footer-brand {{
                    font-size: 28px;
                    font-weight: 900;
                    color: #fff;
                    margin-bottom: 16px;
                    letter-spacing: 3px;
                    font-family: 'Poppins', sans-serif;
                    text-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
                }}
                
                .footer p {{
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 16px;
                    margin: 12px 0;
                    line-height: 1.8;
                    font-family: 'Poppins', sans-serif;
                    font-weight: 500;
                }}
                
                .footer-links {{
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.15);
                }}
                
                .footer-links a {{
                    color: {BRAND_COLOR_PRIMARY};
                    text-decoration: none;
                    font-size: 13px;
                    margin: 0 10px;
                    font-weight: 700;
                    font-family: 'Poppins', sans-serif;
                    transition: color 0.3s ease;
                    letter-spacing: 0.5px;
                }}
                
                .footer-links a:hover {{
                    color: {BRAND_COLOR_SECONDARY};
                    text-decoration: underline;
                }}
                
                /* Responsive Design - Geniş */
                @media only screen and (max-width: 900px) {{
                    .email-wrapper {{
                        max-width: 100%;
                        padding: 0 20px;
                    }}
                    
                    body {{
                        padding: 15px;
                    }}
                    
                    .header {{
                        padding: 60px 40px;
                    }}
                    
                    .header h1 {{
                        font-size: 36px;
                    }}
                    
                    .content {{
                        padding: 48px 40px;
                    }}
                    
                    .reset-button {{
                        padding: 18px 36px;
                        font-size: 16px;
                    }}
                    
                    .footer {{
                        padding: 40px 40px;
                    }}
                }}
                
                @media only screen and (max-width: 600px) {{
                    .header {{
                        padding: 40px 24px;
                    }}
                    
                    .header h1 {{
                        font-size: 28px;
                    }}
                    
                    .content {{
                        padding: 36px 24px;
                    }}
                    
                    .reset-button {{
                        padding: 16px 32px;
                        font-size: 15px;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="email-wrapper">
                <div class="email-container">
                    <!-- Header -->
                    <div class="header">
                        <div class="header-content">
                            <div class="header-icon">
                                <img src="{current_logo}" alt="{BRAND_NAME} Logo" style="width: 120px !important; height: 120px !important; max-width: 120px !important; max-height: 120px !important; object-fit: contain !important; display: block !important; margin: 0 auto;" />
                            </div>
                            <h1>Şifre Sıfırlama</h1>
                            <p>{BRAND_NAME} - İşçi Takip Sistemi</p>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="content">
                        <div class="greeting">Merhaba,</div>
                        <p class="instruction">
                            Şifrenizi sıfırlamak için aşağıdaki butona tıklayın. Bu link <strong>1 saat</strong> süreyle geçerlidir.
                        </p>
                        
                        <!-- Reset Button -->
                        <div class="button-container">
                            <a href="{reset_link}" class="reset-button">
                                🔐 Şifremi Sıfırla
                            </a>
                        </div>
                        
                        <!-- Link Fallback -->
                        <div class="link-fallback">
                            <p class="link-fallback-label">Buton çalışmıyorsa, aşağıdaki linki kopyalayıp tarayıcınıza yapıştırın:</p>
                            <p class="link-fallback-url">{reset_link}</p>
                        </div>
                        
                        <!-- Security Warning -->
                        <div class="warning">
                            <div class="warning-header">
                                <span class="warning-icon">⚠️</span>
                                <span class="warning-title">Güvenlik Uyarısı</span>
                            </div>
                            <p class="warning-text">
                                Bu linki kimseyle paylaşmayın. {BRAND_NAME} ekibi asla sizden şifrenizi 
                                veya doğrulama kodunuzu istemez. Eğer bu işlemi siz yapmadıysanız, 
                                bu e-postayı görmezden gelebilir ve hesabınızı güvence altına alabilirsiniz.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="footer">
                        <div class="footer-brand">{BRAND_NAME}</div>
                        <p>© 2024 İşçi Takip Sistemi - Tüm hakları saklıdır.</p>
                        <p>Modern işletmeler için güvenli konum takip çözümü</p>
                        <div class="footer-links">
                            <a href="#">Gizlilik Politikası</a>
                            <span style="color: rgba(255,255,255,0.3);">|</span>
                            <a href="#">Kullanım Koşulları</a>
                            <span style="color: rgba(255,255,255,0.3);">|</span>
                            <a href="#">Yardım Merkezi</a>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""Şifre Sıfırlama - Bavaxe

Merhaba,

Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:
{reset_link}

Bu link 1 saat süreyle geçerlidir.

⚠️ Güvenlik Uyarısı: Bu linki kimseyle paylaşmayın.

© 2024 İşçi Takip Sistemi - Tüm hakları saklıdır.
        """
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'Şifre Sıfırlama - {BRAND_NAME}'
        msg['From'] = SMTP_FROM
        msg['To'] = email
        
        # Attach parts
        part1 = MIMEText(text_body, 'plain', 'utf-8')
        part2 = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        logger.info(f"Attempting to send reset link to {email}")
        if SMTP_SECURE:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
        
        logger.info(f"✅ Reset link sent successfully to {email}")
        return jsonify({
            'success': True,
            'message': 'Reset link sent successfully',
            'email': email
        })
        
    except Exception as e:
        logger.error(f"Unexpected error in send_reset_link: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    smtp_configured = bool(SMTP_USER and SMTP_PASS)
    return jsonify({
        'status': 'OK',
        'service': 'Email Verification Service',
        'smtp_configured': smtp_configured,
        'smtp_host': SMTP_HOST if smtp_configured else None
    })

def send_email(data):
    to_email = data.get('email')
    code = data.get('code')
    
    if not to_email or not code:
        return {"status": "error", "detail": "email and code are required"}
    
    # Send the verification email
    success = send_verification_email(to_email, code)
    
    if success:
        return {"status": "ok", "detail": "email sent"}
    else:
        return {"status": "error", "detail": "failed to send email"}

def main():
    """Main function for command-line usage"""
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}
    result = send_email(payload)
    sys.stdout.write(json.dumps(result))
if __name__ == '__main__':
    port = int(os.getenv('EMAIL_SERVICE_PORT') or os.getenv('PORT', 5001))
    smtp_status = '✅ Configured' if (SMTP_USER and SMTP_PASS) else '❌ Not Configured'
    logger.info("=" * 50)
    logger.info("📧 Email Verification Service")
    logger.info("=" * 50)
    logger.info(f"Port: {port}")
    logger.info(f"SMTP Status: {smtp_status}")
    if SMTP_USER and SMTP_PASS:
        logger.info(f"SMTP Host: {SMTP_HOST}:{SMTP_PORT}")
        logger.info(f"SMTP User: {SMTP_USER}")
    else:
        logger.warning("⚠️  SMTP credentials not set. Email sending will fail.")
        logger.warning("Set SMTP_USER and SMTP_PASS in .env file")
    logger.info("=" * 50)
    try:
        app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False, threaded=True)
    except Exception as e:
        logger.error(f"Failed to start Flask server: {str(e)}")
        sys.exit(1)
