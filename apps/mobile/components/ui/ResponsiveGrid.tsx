import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { SPACING, useLayoutMode } from '@/theme';

/** Une colonne sur téléphone et en portrait, deux colonnes en paysage sur grand écran. */
export function ResponsiveGrid({ children, gap = SPACING.sm }: { children: ReactNode; gap?: number }) {
  const { columns } = useLayoutMode();
  const items = Children.toArray(children);
  if (columns === 1) return <>{items}</>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'stretch' }}>
      {items.map((child, i) => (
        <View key={i} style={{ flexGrow: 0, flexBasis: `${(100 - (columns - 1) * 2) / columns}%`, maxWidth: `${(100 - (columns - 1) * 2) / columns}%` }}>
          {child}
        </View>
      ))}
    </View>
  );
}
