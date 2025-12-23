import React from 'react';
import { Theme } from './types';
import { themeData } from './themeData';

export const ThemeContext = React.createContext<Theme>(themeData);

export const useTheme = (): Theme => {
  const context = React.useContext(ThemeContext);
  return context || themeData;
};
