import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLORS } from '@/theme';

interface Props {
  data: number[];
  width: number;
  height?: number;
  color?: string;
}

/** Courbe lissée minimaliste (portefeuille 30 j). */
export function LineChart({ data, width, height = 90, color = COLORS.blue }: Props) {
  if (data.length < 2) return <View style={{ height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 6 - ((v - min) / range) * (height - 12)] as const);
  const line = pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, '');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const trend = data[data.length - 1] >= data[0] ? 'hausse' : 'baisse';
  return (
    <View accessibilityLabel={`Évolution sur 30 jours : tendance à la ${trend}`}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#fill)" />
        <Path d={line} stroke={color} strokeWidth={2.5} fill="none" />
      </Svg>
    </View>
  );
}
