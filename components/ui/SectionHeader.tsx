import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from './theme/ThemeContext';

interface Props {
  title: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<Props> = ({ title, right, style }) => {
  const theme = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
      {right ? <View>{right}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
});

export default SectionHeader;
