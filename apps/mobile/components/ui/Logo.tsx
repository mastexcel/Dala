import { Image, type ImageStyle } from 'react-native';

const SOURCES = {
  color: require('@/assets/brand/logo-color.png'),
  white: require('@/assets/brand/logo-white.png'),
  black: require('@/assets/brand/logo-black.png'),
};

/** Logo DALA (ratio 3:1). `color` sur fond sombre, `black` sur fond clair. */
export function Logo({ width = 180, variant = 'color', style }: { width?: number; variant?: keyof typeof SOURCES; style?: ImageStyle }) {
  return (
    <Image
      source={SOURCES[variant]}
      style={[{ width, height: width / 3 }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="DALA Finance"
    />
  );
}
