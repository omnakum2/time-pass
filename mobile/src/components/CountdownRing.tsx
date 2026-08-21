import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useCountdown } from '../hooks/useCountdown';
import { timerColor } from '../lib/helpers';
import { scale } from '../lib/scale';

interface Props {
  remainingMs: number;
  fullMs: number;
  startKey: string; // changes when the timer should re-anchor (new turn / resume)
  running?: boolean;
}

/** Native SVG countdown ring with the remaining whole seconds centered inside. */
export function CountdownRing({ remainingMs, fullMs, startKey, running = true }: Props) {
  const { fraction, remaining } = useCountdown(remainingMs, fullMs, startKey, running);

  const size = 44;
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dashoffset = c * fraction; // sweep grows as fraction (time spent) rises
  const color = timerColor(fraction);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Faint gold track behind the progress arc */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(233,184,74,0.18)" strokeWidth={strokeWidth} fill="none" />
        {/* Progress arc: rotate -90 so it starts at 12 o'clock */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[StyleSheet.absoluteFill, styles.label, { color }]}>{remaining}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
    fontSize: scale(14),
  },
});
