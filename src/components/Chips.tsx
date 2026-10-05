import { Pressable, Text, View } from 'react-native';
import { makeStyles, radius, space, type } from '../theme';

type ChipsProps = {
  options: string[];
  selected: string | null;
  onSelect: (option: string) => void;
};

/** Wrapping single-select chips (DESIGN.md §5.5). */
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
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: c.ink, borderColor: c.ink },
  pressed: { transform: [{ scale: 0.97 }] },
  label: { ...type.label, color: c.ink },
  labelActive: { color: c.onInk },
}));
