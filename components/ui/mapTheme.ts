import theme from './theme/index';

export const mapTheme = {
  colors: {
    background: theme.colors.background,
    surface: theme.colors.surface,
    border: theme.colors.border,
    primary: theme.colors.primary,
    accent: theme.colors.accent,
    success: theme.colors.success,
    danger: theme.colors.error,
    text: theme.colors.text,
    textSecondary: theme.colors.textSecondary,
    textMuted: theme.colors.textTertiary,
    gps: {
      active: theme.colors.gps.active,
      inactive: theme.colors.gps.inactive,
      pulse: theme.colors.gps.pulse,
      marker: theme.colors.gps.marker,
      path: theme.colors.gps.path,
      accuracy: theme.colors.gps.accuracy,
      group: theme.colors.gps.group,
      user: theme.colors.gps.user,
      center: theme.colors.gps.center,
    },
  },
  map: {
    style: [
      {
        elementType: 'geometry',
        stylers: [{ color: '#1e293b' }],
      },
      {
        elementType: 'labels.text.fill',
        stylers: [{ color: '#94a3b8' }],
      },
      {
        elementType: 'labels.text.stroke',
        stylers: [{ color: '#0f172a' }],
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#0f172a' }],
      },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#334155' }],
      },
      {
        featureType: 'road',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#64748b' }],
      },
      {
        featureType: 'poi',
        elementType: 'geometry',
        stylers: [{ color: '#1e293b' }],
      },
      {
        featureType: 'poi',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#64748b' }],
      },
      {
        featureType: 'transit',
        elementType: 'geometry',
        stylers: [{ color: '#334155' }],
      },
      {
        featureType: 'administrative',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#475569', width: 2 }],
      },
      {
        featureType: 'administrative',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#94a3b8' }],
      },
    ],
    darkStyle: [
      {
        elementType: 'geometry',
        stylers: [{ color: '#0f172a' }],
      },
      {
        elementType: 'labels.text.fill',
        stylers: [{ color: '#64748b' }],
      },
      {
        elementType: 'labels.text.stroke',
        stylers: [{ color: '#000000' }],
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#020617' }],
      },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#1e293b' }],
      },
      {
        featureType: 'road',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#475569' }],
      },
      {
        featureType: 'poi',
        elementType: 'geometry',
        stylers: [{ color: '#0f172a' }],
      },
      {
        featureType: 'poi',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#475569' }],
      },
      {
        featureType: 'transit',
        elementType: 'geometry',
        stylers: [{ color: '#1e293b' }],
      },
      {
        featureType: 'administrative',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#334155', width: 2 }],
      },
      {
        featureType: 'administrative',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#64748b' }],
      },
    ],
  },
  markers: {
    user: {
      size: 50,
      color: theme.colors.gps.marker,
      borderColor: '#fff',
      borderWidth: 4,
      pulseColor: theme.colors.gps.pulse,
    },
    group: {
      size: 42,
      color: theme.colors.gps.group,
      borderColor: '#fff',
      borderWidth: 3,
    },
    center: {
      size: 50,
      color: theme.colors.gps.center,
      borderColor: '#fff',
      borderWidth: 4,
    },
    other: {
      size: 40,
      color: theme.colors.textTertiary,
      borderColor: '#fff',
      borderWidth: 2,
    },
  },
  path: {
    color: theme.colors.gps.path,
    width: 5,
    lineCap: 'round',
    lineJoin: 'round',
  },
  accuracy: {
    outer: {
      color: 'rgba(6,182,212,0.5)',
      fillColor: 'rgba(6,182,212,0.12)',
      strokeWidth: 2,
    },
    inner: {
      color: 'rgba(6,182,212,0.3)',
      fillColor: 'rgba(6,182,212,0.06)',
      strokeWidth: 1,
    },
  },
  controls: {
    backgroundColor: '#fff',
    borderColor: '#e6eef0',
    iconColor: '#083344',
    activeColor: theme.colors.primary,
  },
  callout: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderColor: 'rgba(6,182,212,0.1)',
    shadow: theme.shadows.lg,
  },
};

export default mapTheme;

