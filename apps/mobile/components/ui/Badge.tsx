import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { RADIUS, SPACING } from '@/theme';
import { AppText } from './AppText';

interface Props {
  label: string;
  color: string;
  background?: string;
  icon?: ReactNode;
}

export function Badge({ label, color, background, icon }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: background ?? `${color}1F` }]}>
      {icon}
      <AppText variant="small" weight="bold" color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
});
