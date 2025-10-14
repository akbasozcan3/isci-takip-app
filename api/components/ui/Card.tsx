import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import theme from './theme';

interface Props {
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const Card: React.FC<Props> = ({ style, children }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
});

export default Card;
