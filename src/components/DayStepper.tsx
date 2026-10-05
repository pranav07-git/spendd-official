import { Pressable, Text, View } from 'react-native';
import { addDays, formatDate, startOfDay } from '../transactions/format';
import { makeStyles, space, type, useTheme } from '../theme';
import { ChevronForwardIcon, ChevronLeftIcon } from './Icons';

function dayLabel(day: number): string {
  const today = startOfDay(Date.now());
  if (day === today) {
    return 'Today';
  }
  if (day === addDays(today, -1)) {
    return 'Yesterday';
  }
  return day === addDays(today, 1) ? 'Tomorrow' : formatDate(day);
}

type Props = {
  /** Start-of-day timestamp. */
  value: number;
  onChange: (day: number) => void;
  min?: number;
  max?: number;
  accessibilityLabel: string;
};

/** ‹ Today › — steps a date a day at a time; no date-picker dependency needed. */
export function DayStepper({ value, onChange, min, max, accessibilityLabel }: Props) {
  const s = useStyles();
  const { c } = useTheme();
  const atMin = min != null && value <= min;
  const atMax = max != null && value >= max;
  return (
    <View style={s.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: previous day`}
        disabled={atMin}
        hitSlop={10}
        onPress={() => onChange(addDays(value, -1))}>
        <ChevronLeftIcon size={18} color={atMin ? c.inkSubtle : c.ink} strokeWidth={2} />
      </Pressable>
      <Text style={s.value} accessibilityLabel={`${accessibilityLabel}: ${dayLabel(value)}`}>
        {dayLabel(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: next day`}
        disabled={atMax}
        hitSlop={10}
        onPress={() => onChange(addDays(value, 1))}>
        <ChevronForwardIcon size={18} color={atMax ? c.inkSubtle : c.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  value: { ...type.bodyStrong, color: c.ink, minWidth: 104, textAlign: 'center' },
}));
