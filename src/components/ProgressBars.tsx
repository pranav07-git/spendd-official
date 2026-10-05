import { View } from 'react-native';
import { makeStyles, radius, space } from '../theme';

/** Segmented progress for short sequences (DESIGN.md §5.11). */
export function ProgressBars({ total, active }: { total: number; active: number }) {
  const s = useStyles();
  return (
    <View style={s.row} accessibilityLabel={`Step ${active + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[s.bar, i < active && s.done, i === active && s.active]} />
      ))}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  row: { flexDirection: 'row', gap: space[2] },
  bar: { flex: 1, maxWidth: 56, height: 4, borderRadius: radius.pill, backgroundColor: c.line },
  done: { backgroundColor: c.ink },
  active: { backgroundColor: c.marigold },
}));
