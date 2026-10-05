import { Text, View } from 'react-native';
import { initialFor } from '../transactions/format';
import type { Transaction } from '../transactions/types';
import { jarColorFor, makeStyles, type, useTheme } from '../theme';

/** Merchant avatar (DESIGN.md §3.8): a circle with the first letter on the payee's jar colour. */
export function PayeeAvatar({ tx, size = 40 }: { tx: Transaction; size?: number }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: jarColorFor(tx.counterparty ?? tx.category ?? '', c) },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text style={[s.text, size > 48 && { fontSize: size * 0.42, lineHeight: size * 0.5 }]}>{initialFor(tx)}</Text>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { ...type.bodyStrong, color: c.ink },
}));
