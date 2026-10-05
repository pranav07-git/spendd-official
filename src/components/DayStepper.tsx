import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, formatDate, startOfDay } from '../transactions/format';
import { colors, fonts } from '../theme';
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
  const atMin = min != null && value <= min;
  const atMax = max != null && value >= max;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: previous day`}
        disabled={atMin}
        hitSlop={10}
        onPress={() => onChange(addDays(value, -1))}>
        <ChevronLeftIcon size={18} color={atMin ? colors.inkFaint : colors.ink} strokeWidth={2} />
      </Pressable>
      <Text style={styles.value} accessibilityLabel={`${accessibilityLabel}: ${dayLabel(value)}`}>
        {dayLabel(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: next day`}
        disabled={atMax}
        hitSlop={10}
        onPress={() => onChange(addDays(value, 1))}>
        <ChevronForwardIcon size={18} color={atMax ? colors.inkFaint : colors.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.ink, minWidth: 104, textAlign: 'center' },
});
