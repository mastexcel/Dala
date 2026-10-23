import { Image, type ImageStyle, type StyleProp } from 'react-native';

const SOURCES = {
  /** Dégradé arc-en-ciel, pour fond sombre (navy). */
  color: require('@/assets/brand/logo-color.png'),
  /** Dégradé arc-en-ciel, pour fond clair. */
  colorLight: require('@/assets/brand/logo-color-on-light.png'),
  /** Rayures blanches, pour fond sombre. */
  white: require('@/assets/brand/logo-white.png'),
  /** Rayures blanches fines, pour filigranes et fonds sombres. */
  whiteFine: require('@/assets/brand/logo-white-fine.png'),
  /** Rayures noires, pour fond clair (documents, mentions). */
  black: require('@/assets/brand/logo-black.png'),
};

export type LogoVariant = keyof typeof SOURCES;

/** Logo DALA (ratio 3:1). */
export function Logo({ width = 180, variant = 'color', style }: { width?: number; variant?: LogoVariant; style?: StyleProp<ImageStyle> }) {
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
