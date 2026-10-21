import { Text, type TextProps, type TextStyle } from 'react-native';
import { COLORS, FONTS, SIZES } from '@/theme';

type Variant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'small';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const WEIGHT_FONT: Record<Weight, string> = {
  regular: FONTS.body,
  medium: FONTS.bodyMedium,
  semibold: FONTS.bodySemiBold,
  bold: FONTS.bodyBold,
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  weight?: Weight;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Titres en DM Serif Display. */
  serif?: boolean;
}

/** Texte de base : tailles adaptatives (Dynamic Type) plafonnées pour préserver la mise en page. */
export function AppText({ variant = 'body', weight = 'regular', color = COLORS.black, align, serif, style, ...rest }: AppTextProps) {
  const isHeading = variant === 'h1' || variant === 'h2';
  const fontFamily = (serif ?? isHeading) ? FONTS.heading : WEIGHT_FONT[weight];
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      accessibilityRole={isHeading ? 'header' : undefined}
      style={[{ fontFamily, fontSize: SIZES[variant], color, textAlign: align, lineHeight: Math.round(SIZES[variant] * 1.35) }, style]}
      {...rest}
    />
  );
}
