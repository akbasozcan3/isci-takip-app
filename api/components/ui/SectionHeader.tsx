import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import theme from './theme';

interface Props {
  title: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<Props> = ({ title, right, style }) => (
  <View style={[styles.row, style]}>
    <Text style={styles.title}>{title}</Text>
    {right ? <View>{right}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
});

export default SectionHeader;
