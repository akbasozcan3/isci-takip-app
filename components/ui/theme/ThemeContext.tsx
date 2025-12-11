import React from 'react';
import { Theme } from './index';

export const ThemeContext = React.createContext<Theme | null>(null);

export const useTheme = (): Theme => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    return require('./index').default;
  }
  return context;
};
