// Konum Paylaşım Utility - Tüm ekranlardan kullanılabilir
import { Clipboard, Share } from 'react-native';
import { authFetch } from './auth';

export interface ShareLocationOptions {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

export interface ShareLocationResult {
  shareUrl: string;
  googleMapsUrl: string;
  appleMapsUrl: string;
  shareToken: string;
}

/**
 * Konum paylaşım linki oluştur ve paylaş
 * Tüm ekranlardan kullanılabilir
 */
export async function shareLocation(
  options: ShareLocationOptions,
  onSuccess?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    // Backend'den paylaşım linki oluştur
    const res = await authFetch('/location/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: options.lat,
        lng: options.lng,
        name: options.name || 'Konumum',
        address: options.address || null
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Paylaşım linki oluşturulamadı' }));
      throw new Error(errorData.error || 'Paylaşım linki oluşturulamadı');
    }

    const data = await res.json();
    const shareUrl = data.data?.shareUrl || data.shareUrl;
    const googleMapsUrl = data.data?.googleMapsUrl || data.googleMapsUrl;
    const appleMapsUrl = data.data?.appleMapsUrl || data.appleMapsUrl;

    if (!shareUrl) {
      throw new Error('Paylaşım linki alınamadı');
    }

    try {
      await Clipboard.setString(shareUrl);
    } catch (clipError) {
      console.warn('Clipboard error (non-critical):', clipError);
    }

    const shareMessage = `📍 ${options.name || 'Konumum'}\n\n🔗 Paylaşım Linki: ${shareUrl}\n\n🗺️ Google Maps: ${googleMapsUrl}${appleMapsUrl ? `\n🍎 Apple Maps: ${appleMapsUrl}` : ''}\n\n📍 Koordinatlar: ${options.lat.toFixed(6)}, ${options.lng.toFixed(6)}`;

    const result = await Share.share({
      message: shareMessage,
      url: shareUrl,
      title: 'Konum Paylaş'
    });

    if (result.action === Share.sharedAction || result.action === Share.dismissedAction) {
      onSuccess?.();
    }
  } catch (error: any) {
    console.error('Share location error:', error);
    onError?.(error.message || 'Paylaşım başarısız oldu');
  }
}

/**
 * Mevcut konumu al ve paylaş
 */
export async function shareCurrentLocation(
  getCurrentLocation: () => Promise<{ latitude: number; longitude: number } | null>,
  name?: string,
  onSuccess?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const location = await getCurrentLocation();
    if (!location) {
      onError?.('Konum bilgisi alınamadı');
      return;
    }

    await shareLocation(
      {
        lat: location.latitude,
        lng: location.longitude,
        name: name || 'Mevcut Konumum'
      },
      onSuccess,
      onError
    );
  } catch (error: any) {
    onError?.(error.message || 'Konum paylaşımı başarısız oldu');
  }
}

