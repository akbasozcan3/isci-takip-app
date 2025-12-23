export interface Theme {
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    
    secondary: string;
    secondaryDark: string;
    secondaryLight: string;
    
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    backgroundElevated: string;
    
    surface: string;
    surfaceSecondary: string;
    surfaceElevated: string;
    
    text: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;
    
    border: string;
    borderSecondary: string;
    borderFocus: string;
    
    success: string;
    successLight: string;
    successDark: string;
    
    warning: string;
    warningLight: string;
    warningDark: string;
    
    error: string;
    errorLight: string;
    errorDark: string;
    
    info: string;
    infoLight: string;
    infoDark: string;
    
    accent: string;
    accentLight: string;
    accentDark: string;
    
    overlay: string;
    overlayDark: string;
    
    gradients: {
      primary: string[];
      secondary: string[];
      success: string[];
      warning: string[];
      error: string[];
      background: string[];
    };
    
    gps: {
      active: string;
      inactive: string;
      pulse: string;
      marker: string;
      path: string;
      accuracy: string;
      group: string;
      user: string;
      center: string;
    };
  };
  
  typography: {
    fontFamily: {
      regular: string;
      medium: string;
      semiBold: string;
      bold: string;
      black: string;
    };
    fontSize: {
      xs: number;
      sm: number;
      base: number;
      lg: number;
      xl: number;
      '2xl': number;
      '3xl': number;
      '4xl': number;
      '5xl': number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
      loose: number;
    };
    fontWeight: {
      light: string;
      regular: string;
      medium: string;
      semiBold: string;
      bold: string;
      black: string;
    };
  };
  
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
  };
  
  borderRadius: {
    none: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    full: number;
  };
  
  shadows: {
    sm: object;
    md: object;
    lg: object;
    xl: object;
    '2xl': object;
    inner: object;
  };
  
  animation: {
    duration: {
      fast: number;
      normal: number;
      slow: number;
    };
    easing: {
      default: string;
      easeIn: string;
      easeOut: string;
      easeInOut: string;
    };
  };
  
  components: {
    button: {
      height: {
        sm: number;
        md: number;
        lg: number;
      };
      padding: {
        sm: { horizontal: number; vertical: number };
        md: { horizontal: number; vertical: number };
        lg: { horizontal: number; vertical: number };
      };
    };
    input: {
      height: {
        sm: number;
        md: number;
        lg: number;
      };
      padding: {
        sm: { horizontal: number; vertical: number };
        md: { horizontal: number; vertical: number };
        lg: { horizontal: number; vertical: number };
      };
    };
    card: {
      padding: {
        sm: number;
        md: number;
        lg: number;
      };
      borderRadius: number;
    };
  };
}
