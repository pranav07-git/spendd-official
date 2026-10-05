import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type ChipsProps = {
  options: string[];
  selected: string | null;
  onSelect: (option: string) => void;
};

/** Wrapping single-select pills, styled like the Transactions filter chips. */
export function Chips({ options, selected, onSelect }: ChipsProps) {
  return (
    <View style={styles.wrap}>
      {options.map(option => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option)}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.label, active && styles.labelActive]}>{option.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1.5, color: colors.inkMuted },
  labelActive: { color: colors.background },
});
