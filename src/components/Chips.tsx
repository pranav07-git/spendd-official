import { Pressable, Text, View } from 'react-native';
import { makeStyles, radius, space, type } from '../theme';

const CHIP_SLOP = { top: 4, bottom: 4 };

type ChipsProps = {
  options: string[];
  selected: string | null;
  onSelect: (option: string) => void;
};

/** Wrapping single-select chips (docs/DESIGN.md). */
export function Chips({ options, selected, onSelect }: ChipsProps) {
  const s = useStyles();
  return (
    <View style={s.wrap}>
      {options.map(option => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option)}
            // 36 dp tall to look light; the slop makes the touch area the full 44 dp.
            hitSlop={CHIP_SLOP}
            style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]}>
            <Text style={[s.label, active && s.labelActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 36,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: c.ink },
  pressed: { opacity: 0.7 },
  label: { ...type.label, color: c.inkMuted },
  labelActive: { color: c.onInk },
}));
