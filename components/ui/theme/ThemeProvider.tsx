import React from 'react';
import { ThemeContext } from './ThemeContext';
import { themeData } from './themeData';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ThemeContext.Provider value={themeData}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
