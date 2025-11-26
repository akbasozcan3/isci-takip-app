#!/usr/bin/env python3
"""
Email Verification Service
Sends verification codes via email using SMTP
Backend generates the code and sends it here for email delivery
"""

import os
import smtplib
import re
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
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'İşçi Takip - E-posta Doğrulama Kodu'
        msg['From'] = SMTP_FROM
        msg['To'] = to_email

        # Create HTML email body with modern design
        html_body = f"""
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>E-posta Doğrulama - Bavaxe</title>
            <style>
                /* Reset & Base Styles */
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                body {{ 
                    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6; 
                    color: #1f2937; 
                    background-color: #f3f4f6;
                    padding: 20px;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }}
                
                /* Email Container */
                .email-wrapper {{
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                }}
                
                .email-container {{
                    background-color: #ffffff;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                    border: 1px solid #e5e7eb;
                }}
                
                /* Header Section */
                .header {{
                    background: linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%);
                    color: white;
                    padding: 48px 32px;
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
                    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                    animation: pulse 3s ease-in-out infinite;
                }}
                
                @keyframes pulse {{
                    0%, 100% {{ opacity: 0.3; }}
                    50% {{ opacity: 0.6; }}
                }}
                
                .header-content {{
                    position: relative;
                    z-index: 1;
                }}
                
                .header-icon {{
                    width: 80px;
                    height: 80px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 20px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 20px;
                    backdrop-filter: blur(10px);
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
                }}
                
                .header-icon-text {{
                    font-size: 40px;
                }}
                
                .header h1 {{
                    font-size: 32px;
                    font-weight: 900;
                    margin-bottom: 8px;
                    letter-spacing: 0.5px;
                    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                }}
                
                .header p {{
                    font-size: 16px;
                    opacity: 0.95;
                    font-weight: 500;
                }}
                
                /* Content Section */
                .content {{
                    padding: 48px 32px;
                    background-color: #ffffff;
                }}
                
                .greeting {{
                    color: #1f2937;
                    font-size: 20px;
                    margin-bottom: 16px;
                    font-weight: 700;
                }}
                
                .instruction {{
                    color: #4b5563;
                    font-size: 16px;
                    margin-bottom: 32px;
                    line-height: 1.7;
                }}
                
                /* Code Container - Premium Design */
                .code-container {{
                    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
                    border-radius: 20px;
                    padding: 40px 32px;
                    margin: 32px 0;
                    text-align: center;
                    box-shadow: 0 12px 32px rgba(6, 182, 212, 0.4);
                    position: relative;
                    overflow: hidden;
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
                    font-size: 48px;
                    font-weight: 900;
                    letter-spacing: 12px;
                    font-family: 'Courier New', 'Monaco', monospace;
                    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    margin-bottom: 12px;
                    display: inline-block;
                    padding: 8px 16px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    backdrop-filter: blur(10px);
                }}
                
                .code-label {{
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    font-weight: 700;
                }}
                
                /* Expiry Info */
                .expiry-info {{
                    color: #4b5563;
                    font-size: 15px;
                    margin: 24px 0;
                    padding: 16px;
                    background: #f9fafb;
                    border-radius: 12px;
                    border-left: 4px solid #06b6d4;
                }}
                
                .expiry-info strong {{
                    color: #06b6d4;
                    font-weight: 700;
                }}
                
                /* Warning Box - Enhanced */
                .warning {{
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border: 2px solid #f59e0b;
                    border-radius: 16px;
                    padding: 20px;
                    margin: 24px 0;
                    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
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
                    font-size: 15px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }}
                
                .warning-text {{
                    color: #92400e;
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 0;
                    font-weight: 500;
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
                
                /* Footer */
                .footer {{
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    padding: 32px;
                    text-align: center;
                    color: rgba(255, 255, 255, 0.8);
                }}
                
                .footer-brand {{
                    font-size: 18px;
                    font-weight: 800;
                    color: #fff;
                    margin-bottom: 8px;
                    letter-spacing: 1px;
                }}
                
                .footer p {{
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 13px;
                    margin: 6px 0;
                    line-height: 1.6;
                }}
                
                .footer-links {{
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }}
                
                .footer-links a {{
                    color: #06b6d4;
                    text-decoration: none;
                    font-size: 12px;
                    margin: 0 8px;
                    font-weight: 600;
                    transition: color 0.3s ease;
                }}
                
                .footer-links a:hover {{
                    color: #7c3aed;
                }}
                
                /* Responsive Design */
                @media only screen and (max-width: 600px) {{
                    body {{
                        padding: 10px;
                    }}
                    
                    .header {{
                        padding: 32px 24px;
                    }}
                    
                    .header h1 {{
                        font-size: 24px;
                    }}
                    
                    .content {{
                        padding: 32px 24px;
                    }}
                    
                    .code {{
                        font-size: 36px;
                        letter-spacing: 8px;
                    }}
                    
                    .code-container {{
                        padding: 32px 24px;
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
                                <span class="header-icon-text">🔐</span>
                            </div>
                            <h1>E-posta Doğrulama</h1>
                            <p>Bavaxe - İşçi Takip Sistemi</p>
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
                                Bu kodu kimseyle paylaşmayın. Bavaxe ekibi asla sizden şifrenizi 
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
                        <div class="footer-brand">Bavaxe</div>
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
        
        # Build email HTML
        html_body = f"""
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Şifre Sıfırlama - Bavaxe</title>
        </head>
        <body style="font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;padding:20px;margin:0;">
            <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.12);">
                <div style="background:linear-gradient(135deg,#06b6d4 0%,#7c3aed 100%);color:white;padding:48px 32px;text-align:center;">
                    <div style="width:80px;height:80px;background:rgba(255,255,255,0.2);border-radius:20px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:40px;">🔐</div>
                    <h1 style="font-size:32px;font-weight:900;margin:0 0 8px 0;letter-spacing:0.5px;">Şifre Sıfırlama</h1>
                    <p style="font-size:16px;opacity:0.95;margin:0;font-weight:500;">Bavaxe - İşçi Takip Sistemi</p>
                </div>
                <div style="padding:48px 32px;background:#ffffff;">
                    <div style="color:#1f2937;font-size:20px;margin-bottom:16px;font-weight:700;">Merhaba,</div>
                    <p style="color:#4b5563;font-size:16px;margin-bottom:32px;line-height:1.7;">
                        Şifrenizi sıfırlamak için aşağıdaki butona tıklayın. Bu link <strong>1 saat</strong> süreyle geçerlidir.
                    </p>
                    <div style="text-align:center;margin:32px 0;">
                        <a href="{reset_link}" style="display:inline-block;background:linear-gradient(135deg,#06b6d4 0%,#0891b2 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 4px 12px rgba(6,182,212,0.4);">
                            Şifremi Sıfırla
                        </a>
                    </div>
                    <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:12px;border-left:4px solid #06b6d4;">
                        <p style="color:#4b5563;font-size:13px;margin:0 0 8px 0;font-weight:600;">Buton çalışmıyorsa, aşağıdaki linki kopyalayıp tarayıcınıza yapıştırın:</p>
                        <p style="color:#06b6d4;font-size:12px;word-break:break-all;margin:0;font-family:monospace;">{reset_link}</p>
                    </div>
                    <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:2px solid #f59e0b;border-radius:16px;padding:20px;margin:24px 0;">
                        <div style="display:flex;align-items:center;margin-bottom:12px;">
                            <span style="font-size:24px;margin-right:12px;">⚠️</span>
                            <span style="color:#92400e;font-size:15px;font-weight:800;text-transform:uppercase;">Güvenlik Uyarısı</span>
                        </div>
                        <p style="color:#92400e;font-size:14px;line-height:1.6;margin:0;font-weight:500;">
                            Bu linki kimseyle paylaşmayın. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilir ve hesabınızı güvence altına alabilirsiniz.
                        </p>
                    </div>
                </div>
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px;text-align:center;color:rgba(255,255,255,0.8);">
                    <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;letter-spacing:1px;">Bavaxe</div>
                    <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:6px 0;line-height:1.6;">© 2024 İşçi Takip Sistemi - Tüm hakları saklıdır.</p>
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
        msg['Subject'] = 'Şifre Sıfırlama - Bavaxe'
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

if __name__ == '__main__':
    port = int(os.getenv('EMAIL_SERVICE_PORT', 5001))
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
    app.run(host='0.0.0.0', port=port, debug=os.getenv('NODE_ENV') == 'development')
