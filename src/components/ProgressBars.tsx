import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export function ProgressBars({ total, active }: { total: number; active: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`Step ${active + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.bar, i === active && styles.active]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  bar: { width: 48, height: 3, backgroundColor: colors.progressInactive },
  active: { backgroundColor: colors.text },
});
