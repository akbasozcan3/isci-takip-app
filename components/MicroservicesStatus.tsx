import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { microservicesClient, ServiceStatus } from '../utils/microservices';

interface MicroservicesStatusProps {
  compact?: boolean;
}

export function MicroservicesStatus({ compact = false }: MicroservicesStatusProps) {
  const [services, setServices] = React.useState<Record<string, ServiceStatus>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const status = await microservicesClient.getServiceStatus();
      setServices(status);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    );
  }

  if (compact) {
    const healthyCount = Object.values(services).filter(s => s.healthy).length;
    const totalCount = Object.keys(services).length;
    
    return (
      <View style={styles.compactContainer}>
        <Ionicons 
          name={healthyCount === totalCount ? "checkmark-circle" : "warning"} 
          size={16} 
          color={healthyCount === totalCount ? "#10b981" : "#f59e0b"} 
        />
        <Text style={styles.compactText}>
          {healthyCount}/{totalCount} Servisler Aktif
        </Text>
      </View>
    );
  }

  const activeServices = Object.entries(services).filter(([_, status]) => status.healthy);
  const hasServices = Object.keys(services).length > 0;

  if (!hasServices) {
    return null;
  }

  if (activeServices.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sistem Durumu</Text>
        <View style={styles.emptyState}>
          <Ionicons name="server-outline" size={32} color="#64748b" />
          <Text style={styles.emptyText}>Servisler başlatılıyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sistem Durumu</Text>
      <View style={styles.servicesGrid}>
        {activeServices.map(([name, status]) => (
          <View key={name} style={styles.serviceCard}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.serviceIcon}
            >
              <Ionicons 
                name="checkmark" 
                size={20} 
                color="#fff" 
              />
            </LinearGradient>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{name.toUpperCase()}</Text>
              <Text style={styles.serviceStatus}>Aktif</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  compactText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Poppins-Bold',
  },
  servicesGrid: {
    gap: 12,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Poppins-Bold',
  },
  serviceStatus: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
  },
});
