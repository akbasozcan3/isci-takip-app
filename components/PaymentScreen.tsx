import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authFetch } from '../utils/auth';

interface PaymentScreenProps {
  visible: boolean;
  planId: string;
  planName: string;
  amount: number;
  currency?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CardIcon = ({ type, size = 32 }: { type: string; size?: number }) => {
  if (type === 'visa') {
    return (
      <View style={[styles.cardIconContainer, { width: size, height: size * 0.6 }]}>
        <LinearGradient
          colors={['#1a1f71', '#1434a4']}
          style={styles.cardIconGradient}
        >
          <Text style={[styles.cardIconText, { fontSize: size * 0.35 }]}>VISA</Text>
        </LinearGradient>
      </View>
    );
  }
  if (type === 'mastercard') {
    return (
      <View style={[styles.cardIconContainer, { width: size, height: size * 0.6 }]}>
        <View style={styles.mcIconContainer}>
          <View style={[styles.mcIconCircle, styles.mcIconCircle1, { width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25 }]} />
          <View style={[styles.mcIconCircle, styles.mcIconCircle2, { width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, left: size * 0.3 }]} />
        </View>
      </View>
    );
  }
  if (type === 'amex') {
    return (
      <View style={[styles.cardIconContainer, { width: size, height: size * 0.6 }]}>
        <LinearGradient
          colors={['#006fcf', '#012169']}
          style={styles.cardIconGradient}
        >
          <Text style={[styles.cardIconText, { fontSize: size * 0.3 }]}>AMEX</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[styles.cardIconContainer, { width: size, height: size * 0.6 }]}>
      <Ionicons name="card" size={size * 0.5} color="#94a3b8" />
    </View>
  );
};

export default function PaymentScreen({
  visible,
  planId,
  planName,
  amount,
  currency = 'USD',
  onSuccess,
  onCancel
}: PaymentScreenProps) {
  const getDisplayAmount = () => {
    if (currency === 'USD') {
      return Math.round(amount / 30);
    }
    return amount;
  };

  const displayAmount = getDisplayAmount();
  const displayCurrency = currency === 'USD' ? '$' : '₺';
  const [cardNumber, setCardNumber] = React.useState('');
  const [expiry, setExpiry] = React.useState('');
  const [cvc, setCvc] = React.useState('');
  const [cardName, setCardName] = React.useState('');
  const [processing, setProcessing] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const [touchedFields, setTouchedFields] = React.useState<Record<string, boolean>>({});
  const cardFlip = React.useRef(new Animated.Value(0)).current;
  const shakeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (focusedField === 'cvc') {
      Animated.spring(cardFlip, {
        toValue: 1,
        useNativeDriver: true,
        tension: 10,
        friction: 8
      }).start();
    } else {
      Animated.spring(cardFlip, {
        toValue: 0,
        useNativeDriver: true,
        tension: 10,
        friction: 8
      }).start();
    }
  }, [focusedField]);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '').replace(/[^0-9]/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19);
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const getCardType = (number: string) => {
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    if (/^6/.test(cleaned)) return 'discover';
    return 'default';
  };

  const validateCardNumber = (number: string): { valid: boolean; error?: string } => {
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.length === 0) {
      return { valid: false, error: 'Kart numarası gereklidir' };
    }
    if (cleaned.length < 13) {
      return { valid: false, error: 'Kart numarası çok kısa' };
    }
    if (cleaned.length > 19) {
      return { valid: false, error: 'Kart numarası çok uzun' };
    }
    if (!/^\d+$/.test(cleaned)) {
      return { valid: false, error: 'Sadece rakam girin' };
    }
    let sum = 0;
    let isEven = false;
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i], 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      isEven = !isEven;
    }
    if (sum % 10 !== 0 && cleaned.length >= 13) {
      return { valid: false, error: 'Geçersiz kart numarası' };
    }
    return { valid: true };
  };

  const validateExpiry = (exp: string): { valid: boolean; error?: string } => {
    if (!exp || exp.length === 0) {
      return { valid: false, error: 'Son kullanma tarihi gereklidir' };
    }
    const parts = exp.split('/');
    if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2) {
      return { valid: false, error: 'Format: MM/YY' };
    }
    const month = parseInt(parts[0], 10);
    const year = parseInt('20' + parts[1], 10);
    const now = new Date();
    if (month < 1 || month > 12) {
      return { valid: false, error: 'Geçersiz ay (01-12)' };
    }
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      return { valid: false, error: 'Kartın süresi dolmuş' };
    }
    return { valid: true };
  };

  const validateCVC = (cvcValue: string): { valid: boolean; error?: string } => {
    if (!cvcValue || cvcValue.length === 0) {
      return { valid: false, error: 'CVV gereklidir' };
    }
    if (cvcValue.length < 3) {
      return { valid: false, error: 'CVV en az 3 haneli olmalıdır' };
    }
    if (cvcValue.length > 4) {
      return { valid: false, error: 'CVV en fazla 4 haneli olabilir' };
    }
    if (!/^\d+$/.test(cvcValue)) {
      return { valid: false, error: 'Sadece rakam girin' };
    }
    return { valid: true };
  };

  const validateCardName = (name: string): { valid: boolean; error?: string } => {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Kart üzerindeki isim gereklidir' };
    }
    if (name.trim().length < 2) {
      return { valid: false, error: 'İsim en az 2 karakter olmalıdır' };
    }
    if (name.trim().length > 50) {
      return { valid: false, error: 'İsim çok uzun' };
    }
    return { valid: true };
  };

  const validateField = (field: string, value: string) => {
    let validation: { valid: boolean; error?: string } = { valid: true };
    
    switch (field) {
      case 'cardNumber':
        validation = validateCardNumber(value);
        break;
      case 'expiry':
        validation = validateExpiry(value);
        break;
      case 'cvc':
        validation = validateCVC(value);
        break;
      case 'cardName':
        validation = validateCardName(value);
        break;
    }

    if (!validation.valid && touchedFields[field] && validation.error) {
      setErrors(prev => ({ ...prev, [field]: validation.error! }));
    } else if (validation.valid) {
      setErrors(prev => {
        const newErrors: Record<string, string> = {};
        Object.entries(prev).forEach(([key, value]) => {
          if (key !== field && value) {
            newErrors[key] = value;
          }
        });
        return newErrors;
      });
    }
  };

  const cardType = getCardType(cardNumber);
  const cardNumberDisplay = cardNumber || '•••• •••• •••• ••••';
  const expiryDisplay = expiry || 'MM/YY';
  const cvcDisplay = cvc || '•••';
  const cardNameDisplay = cardName || 'AD SOYAD';

  const frontInterpolate = cardFlip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  const backInterpolate = cardFlip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg']
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }]
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }]
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const cardValidation = validateCardNumber(cardNumber);
    if (!cardValidation.valid) {
      newErrors.cardNumber = cardValidation.error || 'Geçerli bir kart numarası girin';
    }

    const expiryValidation = validateExpiry(expiry);
    if (!expiryValidation.valid) {
      newErrors.expiry = expiryValidation.error || 'Geçerli bir son kullanma tarihi girin';
    }

    const cvcValidation = validateCVC(cvc);
    if (!cvcValidation.valid) {
      newErrors.cvc = cvcValidation.error || 'Geçerli bir CVV girin';
    }

    const nameValidation = validateCardName(cardName);
    if (!nameValidation.valid) {
      newErrors.cardName = nameValidation.error || 'Kart üzerindeki ismi girin';
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
    }

    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async () => {
    Object.keys({ cardNumber, expiry, cvc, cardName }).forEach(field => {
      setTouchedFields(prev => ({ ...prev, [field]: true }));
    });

    if (!validateForm()) {
      return;
    }

    setProcessing(true);
    try {
      const cleanedCard = cardNumber.replace(/\s/g, '');
      const expiryParts = expiry.split('/');

      const response = await authFetch('/api/payment/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          cardNumber: cleanedCard,
          expiryMonth: expiryParts[0],
          expiryYear: '20' + expiryParts[1],
          cvc,
          cardName: cardName.trim(),
          amount: amount
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.error || data.message || 'Ödeme işlenemedi';
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('[PaymentScreen] Payment successful:', {
          paymentId: data.paymentId,
          transactionId: data.transactionId,
          gateway: data.gateway,
          receiptNumber: data.receiptNumber
        });
        Alert.alert(
          'Ödeme Başarılı',
          `${planName} planınız aktifleştirildi.${data.receiptNumber ? '\n\nMakbuz No: ' + data.receiptNumber : ''}`,
          [{ text: 'Tamam', onPress: onSuccess }]
        );
      } else {
        throw new Error(data.error || data.message || 'Ödeme başarısız');
      }
    } catch (error: any) {
      Alert.alert('Ödeme Hatası', error.message || 'Ödeme sırasında bir sorun oluştu. Lütfen tekrar deneyin.');
    } finally {
      setProcessing(false);
    }
  };

  const getCardGradient = (): [string, string] => {
    switch (cardType) {
      case 'visa':
        return ['#1a1f71', '#1434a4'];
      case 'mastercard':
        return ['#eb001b', '#f79e1b'];
      case 'amex':
        return ['#006fcf', '#012169'];
      case 'discover':
        return ['#ff6000', '#ff8c00'];
      default:
        return ['#1e293b', '#334155'];
    }
  };

  const shakeStyle = {
    transform: [{ translateX: shakeAnim }]
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <LinearGradient colors={['#0a0f1e', '#1a1f2e', '#0f172a']} style={styles.gradient}>
            <View style={styles.header}>
              <Pressable onPress={onCancel} style={styles.closeButton}>
                <Ionicons name="close" size={22} color="#cbd5e1" />
              </Pressable>
              <View style={styles.headerContent}>
                <View style={styles.headerIconWrapper}>
                  <LinearGradient
                    colors={['#7c3aed', '#a855f7']}
                    style={styles.headerIconGradient}
                  >
                    <Ionicons name="card" size={24} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>Güvenli Ödeme</Text>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{planName} Plan</Text>
                  <Text style={styles.amount}>
                    {displayCurrency}{currency === 'USD' ? displayAmount : displayAmount.toLocaleString('tr-TR')}<Text style={styles.amountPeriod}> / ay</Text>
                  </Text>
                </View>
                <View style={styles.descriptionContainer}>
                  <Text style={styles.descriptionText}>
                    Aboneliğiniz otomatik olarak yenilenecektir. İstediğiniz zaman iptal edebilirsiniz.
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={[styles.cardSection, shakeStyle]}>
                <View style={styles.cardContainer}>
                  <Animated.View style={[styles.card, styles.cardFront, frontAnimatedStyle, { opacity: cardFlip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }) }]}>
                    <LinearGradient colors={getCardGradient()} style={styles.cardGradient} start={[0, 0]} end={[1, 1]}>
                      <View style={styles.cardHeader}>
                        <View style={styles.chipContainer}>
                          <View style={styles.chip}>
                            <View style={styles.chipLines}>
                              {[...Array(6)].map((_, i) => (
                                <View key={i} style={styles.chipLine} />
                              ))}
                            </View>
                          </View>
                        </View>
                        <CardIcon type={cardType} size={40} />
                      </View>
                      <View style={styles.cardNumberContainer}>
                        <Text style={styles.cardNumberText}>{cardNumberDisplay}</Text>
                      </View>
                      <View style={styles.cardFooter}>
                        <View style={styles.cardFooterLeft}>
                          <Text style={styles.cardLabel}>KART SAHİBİ</Text>
                          <Text style={styles.cardNameText}>{cardNameDisplay}</Text>
                        </View>
                        <View style={styles.cardFooterRight}>
                          <Text style={styles.cardLabel}>SON KULLANMA</Text>
                          <Text style={styles.cardExpiryText}>{expiryDisplay}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </Animated.View>

                  <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle, { opacity: cardFlip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }]}>
                    <LinearGradient colors={getCardGradient()} style={styles.cardGradient} start={[0, 0]} end={[1, 1]}>
                      <View style={styles.cardBackStripe} />
                      <View style={styles.cardBackCvc}>
                        <View style={styles.cardBackCvcLabel}>
                          <Text style={styles.cardBackCvcText}>CVV</Text>
                        </View>
                        <View style={styles.cardBackCvcValue}>
                          <Text style={styles.cardBackCvcNumber}>{cvcDisplay}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </Animated.View>
                </View>
              </Animated.View>

              <View style={styles.form}>
                <View style={styles.formGroup}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="card-outline" size={16} color="#94a3b8" style={styles.labelIcon} />
                    <Text style={styles.label}>Kart Numarası</Text>
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, errors.cardNumber && styles.inputError, focusedField === 'cardNumber' && styles.inputFocused]}
                      placeholder="1234 5678 9012 3456"
                      placeholderTextColor="#64748b"
                      value={cardNumber}
                      onChangeText={(text) => {
                        const formatted = formatCardNumber(text);
                        setCardNumber(formatted);
                        if (touchedFields.cardNumber) {
                          validateField('cardNumber', formatted);
                        }
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.cardNumber;
                          return Object.fromEntries(
                            Object.entries(newErrors).filter(([_, v]) => v !== undefined)
                          ) as Record<string, string>;
                        });
                      }}
                      onFocus={() => {
                        setFocusedField('cardNumber');
                        setTouchedFields(prev => ({ ...prev, cardNumber: true }));
                      }}
                      onBlur={() => {
                        setFocusedField(null);
                        validateField('cardNumber', cardNumber);
                      }}
                      keyboardType="numeric"
                      maxLength={19}
                      autoComplete="cc-number"
                    />
                    <View style={styles.inputIconRight}>
                      <CardIcon type={cardType} size={22} />
                    </View>
                  </View>
                  {errors.cardNumber && touchedFields.cardNumber ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={14} color="#ef4444" />
                      <Text style={styles.errorText}>{errors.cardNumber}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, styles.formGroupHalf]}>
                    <View style={styles.labelContainer}>
                      <Ionicons name="calendar-outline" size={16} color="#94a3b8" style={styles.labelIcon} />
                      <Text style={styles.label}>Son Kullanma</Text>
                    </View>
                    <TextInput
                      style={[styles.input, errors.expiry && styles.inputError, focusedField === 'expiry' && styles.inputFocused]}
                      placeholder="MM/YY"
                      placeholderTextColor="#64748b"
                      value={expiry}
                      onChangeText={(text) => {
                        const formatted = formatExpiry(text);
                        setExpiry(formatted);
                        if (touchedFields.expiry) {
                          validateField('expiry', formatted);
                        }
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.expiry;
                          return Object.fromEntries(
                            Object.entries(newErrors).filter(([_, v]) => v !== undefined)
                          ) as Record<string, string>;
                        });
                      }}
                      onFocus={() => {
                        setFocusedField('expiry');
                        setTouchedFields(prev => ({ ...prev, expiry: true }));
                      }}
                      onBlur={() => {
                        setFocusedField(null);
                        validateField('expiry', expiry);
                      }}
                      keyboardType="numeric"
                      maxLength={5}
                      autoComplete="cc-exp"
                    />
                    {errors.expiry && touchedFields.expiry ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={14} color="#ef4444" />
                        <Text style={styles.errorText}>{errors.expiry}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.formGroup, styles.formGroupHalf]}>
                    <View style={styles.labelContainer}>
                      <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" style={styles.labelIcon} />
                      <Text style={styles.label}>CVV</Text>
                    </View>
                    <TextInput
                      style={[styles.input, errors.cvc && styles.inputError, focusedField === 'cvc' && styles.inputFocused]}
                      placeholder="123"
                      placeholderTextColor="#64748b"
                      value={cvc}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/\D/g, '').slice(0, 4);
                        setCvc(cleaned);
                        if (touchedFields.cvc) {
                          validateField('cvc', cleaned);
                        }
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.cvc;
                          return Object.fromEntries(
                            Object.entries(newErrors).filter(([_, v]) => v !== undefined)
                          ) as Record<string, string>;
                        });
                      }}
                      onFocus={() => {
                        setFocusedField('cvc');
                        setTouchedFields(prev => ({ ...prev, cvc: true }));
                      }}
                      onBlur={() => {
                        setFocusedField(null);
                        validateField('cvc', cvc);
                      }}
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry
                      autoComplete="cc-csc"
                    />
                    {errors.cvc && touchedFields.cvc ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={14} color="#ef4444" />
                        <Text style={styles.errorText}>{errors.cvc}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="person-outline" size={16} color="#94a3b8" style={styles.labelIcon} />
                    <Text style={styles.label}>Kart Üzerindeki İsim</Text>
                  </View>
                  <TextInput
                    style={[styles.input, errors.cardName && styles.inputError, focusedField === 'cardName' && styles.inputFocused]}
                    placeholder="AD SOYAD"
                    placeholderTextColor="#64748b"
                    value={cardName}
                    onChangeText={(text) => {
                      const upper = text.toUpperCase();
                      setCardName(upper);
                      if (touchedFields.cardName) {
                        validateField('cardName', upper);
                      }
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.cardName;
                        return Object.fromEntries(
                          Object.entries(newErrors).filter(([_, v]) => v !== undefined)
                        ) as Record<string, string>;
                      });
                    }}
                    onFocus={() => {
                      setFocusedField('cardName');
                      setTouchedFields(prev => ({ ...prev, cardName: true }));
                    }}
                    onBlur={() => {
                      setFocusedField(null);
                      validateField('cardName', cardName);
                    }}
                    autoCapitalize="characters"
                    autoComplete="name"
                  />
                  {errors.cardName && touchedFields.cardName ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={14} color="#ef4444" />
                      <Text style={styles.errorText}>{errors.cardName}</Text>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  style={[styles.payButton, processing && styles.payButtonDisabled]}
                  onPress={handlePayment}
                  disabled={processing}
                >
                  <LinearGradient
                    colors={['#7c3aed', '#6d28d9', '#5b21b6']}
                    style={styles.payButtonGradient}
                    start={[0, 0]}
                    end={[1, 1]}
                  >
                    {processing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="lock-closed" size={16} color="#fff" />
                        <Text style={styles.payButtonText}>
                          {displayCurrency}{currency === 'USD' ? displayAmount : displayAmount.toLocaleString('tr-TR')} <Text style={styles.payButtonTextSmall}>Öde</Text>
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <View style={styles.securityNote}>
                  <View style={styles.securityIcon}>
                    <Ionicons name="shield-checkmark" size={16} color="#06b6d4" />
                  </View>
                  <View style={styles.securityContent}>
                    <Text style={styles.securityTitle}>256-bit SSL Şifreleme ile Güvenli Ödeme</Text>
                    <Text style={styles.securityText}>
                      Ödeme bilgileriniz PCI DSS standartlarına uygun olarak işlenir. Kart bilgileriniz sunucularımızda saklanmaz ve doğrudan ödeme sağlayıcıya iletilir. İyzico ve Stripe gibi güvenilir ödeme altyapıları kullanılmaktadır.
                    </Text>
                  </View>
                </View>

                <View style={styles.paymentMethods}>
                  <Text style={styles.paymentMethodsTitle}>Kabul Edilen Ödeme Yöntemleri</Text>
                  <View style={styles.paymentMethodsIcons}>
                    <View style={styles.paymentMethodIcon}>
                      <CardIcon type="visa" size={32} />
                    </View>
                    <View style={styles.paymentMethodIcon}>
                      <CardIcon type="mastercard" size={32} />
                    </View>
                    <View style={styles.paymentMethodIcon}>
                      <CardIcon type="amex" size={32} />
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </LinearGradient>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e'
  },
  keyboardView: {
    flex: 1
  },
  gradient: {
    flex: 1
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    position: 'relative'
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 8 : 16,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 8
  },
  headerIconWrapper: {
    marginBottom: 12
  },
  headerIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: 0.3
  },
  planInfo: {
    alignItems: 'center',
    marginTop: 2
  },
  planName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 2
  },
  amount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#7c3aed',
    letterSpacing: 0.3
  },
  amountPeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.2
  },
  descriptionContainer: {
    marginTop: 8,
    paddingHorizontal: 20,
    alignItems: 'center'
  },
  descriptionText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32
  },
  cardSection: {
    marginBottom: 20,
    alignItems: 'center',
    height: 180
  },
  cardContainer: {
    width: '100%',
    maxWidth: 320,
    height: 180,
    position: 'relative'
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: 180,
    borderRadius: 16,
    backfaceVisibility: 'hidden'
  },
  cardFront: {
    zIndex: 2
  },
  cardBack: {
    zIndex: 1
  },
  cardGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    padding: 18,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  chipContainer: {
    width: 42,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  chip: {
    width: 34,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden'
  },
  chipLines: {
    flexDirection: 'row',
    height: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 2
  },
  chipLine: {
    width: 2,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 1
  },
  cardIconContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardIconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  cardIconText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1
  },
  mcIconContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  mcIconCircle: {
    position: 'absolute'
  },
  mcIconCircle1: {
    backgroundColor: '#eb001b',
    left: 0,
    zIndex: 1
  },
  mcIconCircle2: {
    backgroundColor: '#f79e1b',
    zIndex: 2
  },
  cardNumberContainer: {
    marginVertical: 14
  },
  cardNumberText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cardFooterLeft: {
    flex: 1
  },
  cardFooterRight: {
    alignItems: 'flex-end'
  },
  cardLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 3,
    letterSpacing: 0.8
  },
  cardNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.8
  },
  cardExpiryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.8
  },
  cardBackStripe: {
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: 16,
    marginHorizontal: -18
  },
  cardBackCvc: {
    marginTop: 16,
    alignItems: 'flex-end'
  },
  cardBackCvcLabel: {
    marginBottom: 6
  },
  cardBackCvcText: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8
  },
  cardBackCvcValue: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3,
    minWidth: 50
  },
  cardBackCvcNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 1.5,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  form: {
    gap: 14
  },
  formGroup: {
    marginBottom: 2
  },
  formGroupHalf: {
    flex: 1
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  labelIcon: {
    marginRight: 5
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e2e8f0',
    letterSpacing: 0.2
  },
  inputContainer: {
    position: 'relative'
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingRight: 50,
    paddingVertical: 12,
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3
  },
  inputFocused: {
    borderColor: '#7c3aed',
    backgroundColor: '#1e293b',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.3,
    shadowRadius: 12
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2
  },
  inputIconRight: {
    position: 'absolute',
    right: 14,
    top: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6
  },
  errorText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '500',
    flex: 1
  },
  payButton: {
    marginTop: 6,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8
  },
  payButtonDisabled: {
    opacity: 0.7
  },
  payButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  payButtonTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: 14,
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.15)'
  },
  securityIcon: {
    marginTop: 1
  },
  securityContent: {
    flex: 1
  },
  securityTitle: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2
  },
  securityText: {
    color: '#94a3b8',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '500'
  },
  paymentMethods: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)'
  },
  paymentMethodsTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.3
  },
  paymentMethodsIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12
  },
  paymentMethodIcon: {
    width: 56,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  }
});
