import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { authFetch } from '../utils/auth';

const { width, height } = Dimensions.get('window');

interface MarkerData {
    id: string;
    latitude: number;
    longitude: number;
    title: string;
    description?: string;
    color?: string;
}

interface FullScreenMapProps {
    visible: boolean;
    onClose: () => void;
    groupId?: string;
    userId: string;
    initialRegion?: Region;
    markers?: MarkerData[];
    showUserLocation?: boolean;
}

export function FullScreenMap({
    visible,
    onClose,
    groupId,
    userId,
    initialRegion,
    markers: externalMarkers,
    showUserLocation = true,
}: FullScreenMapProps) {
    const [loading, setLoading] = React.useState(true);
    const [markers, setMarkers] = React.useState<MarkerData[]>(externalMarkers || []);
    const [region, setRegion] = React.useState<Region>(
        initialRegion || {
            latitude: 41.0082,
            longitude: 28.9784,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
        }
    );

    const scaleAnim = React.useRef(new Animated.Value(0)).current;
    const mapRef = React.useRef<MapView>(null);

    React.useEffect(() => {
        if (visible) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }).start();
            loadMapData();
        } else {
            Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const loadMapData = async () => {
        if (!groupId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await authFetch(`/groups/${groupId}/members-with-locations`);

            if (response.ok) {
                const data = await response.json();
                const locations = data.data || data;

                if (Array.isArray(locations) && locations.length > 0) {
                    const newMarkers: MarkerData[] = locations
                        .filter((loc: any) => loc.latitude && loc.longitude)
                        .map((loc: any, index: number) => ({
                            id: loc.userId || `marker-${index}`,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            title: loc.displayName || loc.userName || 'Kullanıcı',
                            description: loc.timestamp
                                ? `Son güncelleme: ${new Date(loc.timestamp).toLocaleString('tr-TR')}`
                                : undefined,
                            color: loc.userId === userId ? '#0EA5E9' : '#8b5cf6',
                        }));

                    setMarkers(newMarkers);

                    // Fit map to markers
                    if (newMarkers.length > 0 && mapRef.current) {
                        setTimeout(() => {
                            mapRef.current?.fitToCoordinates(
                                newMarkers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
                                {
                                    edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
                                    animated: true,
                                }
                            );
                        }, 500);
                    }
                }
            }
        } catch (error) {
            console.error('[FullScreenMap] Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    const handleZoomIn = () => {
        if (mapRef.current) {
            const newRegion = {
                ...region,
                latitudeDelta: region.latitudeDelta / 2,
                longitudeDelta: region.longitudeDelta / 2,
            };
            mapRef.current.animateToRegion(newRegion, 300);
            setRegion(newRegion);
        }
    };

    const handleZoomOut = () => {
        if (mapRef.current) {
            const newRegion = {
                ...region,
                latitudeDelta: region.latitudeDelta * 2,
                longitudeDelta: region.longitudeDelta * 2,
            };
            mapRef.current.animateToRegion(newRegion, 300);
            setRegion(newRegion);
        }
    };

    return (
        <Modal visible={visible} animationType="none" onRequestClose={handleClose}>
            <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={region}
                    showsUserLocation={showUserLocation}
                    showsMyLocationButton={false}
                    showsCompass={true}
                    showsScale={true}
                    onRegionChangeComplete={setRegion}
                >
                    {markers.map((marker) => (
                        <Marker
                            key={marker.id}
                            coordinate={{
                                latitude: marker.latitude,
                                longitude: marker.longitude,
                            }}
                            title={marker.title}
                            description={marker.description}
                            pinColor={marker.color || '#8b5cf6'}
                        />
                    ))}
                </MapView>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View>
                            <Text style={styles.headerTitle}>Harita Görünümü</Text>
                            <Text style={styles.headerSubtitle}>
                                {markers.length} konum gösteriliyor
                            </Text>
                        </View>
                        <Pressable
                            onPress={handleClose}
                            style={({ pressed }) => [
                                styles.closeButton,
                                pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                            ]}
                            android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
                        >
                            <Ionicons name="close" size={24} color="#fff" />
                        </Pressable>
                    </View>
                </View>

                {/* Zoom Controls */}
                <View style={styles.zoomControls}>
                    <Pressable
                        onPress={handleZoomIn}
                        style={({ pressed }) => [
                            styles.zoomButton,
                            pressed && { opacity: 0.8 },
                        ]}
                        android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </Pressable>
                    <View style={styles.zoomDivider} />
                    <Pressable
                        onPress={handleZoomOut}
                        style={({ pressed }) => [
                            styles.zoomButton,
                            pressed && { opacity: 0.8 },
                        ]}
                        android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
                    >
                        <Ionicons name="remove" size={24} color="#fff" />
                    </Pressable>
                </View>

                {/* Legend */}
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#0EA5E9' }]} />
                        <Text style={styles.legendText}>Siz</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
                        <Text style={styles.legendText}>Diğer Üyeler</Text>
                    </View>
                </View>

                {/* Loading Overlay */}
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <View style={styles.loadingCard}>
                            <ActivityIndicator size="large" color="#0EA5E9" />
                            <Text style={styles.loadingText}>Konum verileri yükleniyor...</Text>
                        </View>
                    </View>
                )}
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    map: {
        width,
        height,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
        fontFamily: 'Poppins-Regular',
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    zoomControls: {
        position: 'absolute',
        right: 20,
        top: Platform.OS === 'ios' ? 150 : 120,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    zoomButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    legend: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    legendText: {
        fontSize: 12,
        color: '#fff',
        fontFamily: 'Poppins-Regular',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    loadingText: {
        fontSize: 14,
        color: '#fff',
        marginTop: 12,
        fontFamily: 'Poppins-Regular',
    },
});
