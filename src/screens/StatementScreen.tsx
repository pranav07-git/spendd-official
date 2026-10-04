import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { OutlineButton, PrimaryButton } from '../components/Buttons';
import { FileCheckIcon, FileUploadIcon } from '../components/Icons';
import { ProgressBars } from '../components/ProgressBars';
import { Screen } from '../components/Screen';
import type { PickedStatement, ScreenProps } from '../navigation/types';
import { colors, fonts } from '../theme';

const SUPPORTED_EXTENSIONS = ['pdf', 'csv', 'qif'];

// Android rarely knows a MIME type for .qif, so it may arrive as text or a
// generic binary; the extension check below is the real filter.
const PICKER_TYPES = [
  types.pdf,
  types.csv,
  types.plainText,
  'application/qif',
  'application/x-qif',
  'application/octet-stream',
];

function formatSize(bytes: number | null) {
  if (bytes == null) {
    return '';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StatementScreen({ navigation }: ScreenProps<'Statement'>) {
  const [file, setFile] = useState<PickedStatement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickStatement = async (): Promise<PickedStatement | null> => {
    try {
      const [result] = await pick({ type: PICKER_TYPES });
      const name = result.name ?? 'statement';
      const extension = name.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        setError('Unsupported file. Choose a PDF, CSV or QIF statement.');
        return null;
      }
      const picked = { uri: result.uri, name, size: result.size, type: result.type };
      setFile(picked);
      setError(null);
      return picked;
    } catch (e) {
      if (!(isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED)) {
        setError('Could not open that file. Please try again.');
      }
      return null;
    }
  };

  const uploadStatement = async () => {
    const statement = file ?? (await pickStatement());
    if (statement) {
      navigation.navigate('Consent', { statement });
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProgressBars total={2} active={1} />

        <Text style={styles.headline}>Start with{'\n'}your spending{'\n'}history</Text>
        <Text style={styles.body}>
          Upload your bank statement to unlock personalized insights from day one.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={file ? `Selected ${file.name}. Tap to change` : 'Choose a statement file'}
          onPress={pickStatement}
          style={({ pressed }) => [styles.dropZone, pressed && styles.dropZonePressed]}>
          <View style={[styles.tick, styles.tickTop]} />
          <View style={[styles.tick, styles.tickBottom]} />
          <View style={[styles.tick, styles.tickLeft]} />
          <View style={[styles.tick, styles.tickRight]} />

          <View style={styles.fileIcon}>{file ? <FileCheckIcon /> : <FileUploadIcon />}</View>
          {file ? (
            <>
              <Text style={styles.dropTitle} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.dropHint}>
                {[formatSize(file.size), 'TAP TO CHANGE'].filter(Boolean).join(' · ')}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.dropTitle}>CLICK</Text>
              <Text style={styles.dropHint}>PDF, CSV, OR QIF SUPPORTED</Text>
            </>
          )}
        </Pressable>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>end to end encrypted</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />
        <PrimaryButton label="UPLOAD STATEMENT" withArrow onPress={uploadStatement} />
        <OutlineButton
          label="START FRESH"
          onPress={() => navigation.navigate('Consent', { statement: null })}
          style={styles.secondary}
        />
      </ScrollView>
    </Screen>
  );
}

const TICK = '#3A3A3A';

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 50,
    lineHeight: 60,
    color: colors.text,
    marginTop: 40,
    letterSpacing: -1,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 25,
    color: colors.textMuted,
    marginTop: 28,
  },
  dropZone: {
    marginTop: 36,
    aspectRatio: 350 / 340,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dropZonePressed: { backgroundColor: colors.surfaceRaised },
  tick: { position: 'absolute', backgroundColor: TICK },
  tickTop: { top: 8, left: '50%', width: 1, height: 14 },
  tickBottom: { bottom: -6, left: '50%', width: 1, height: 14 },
  tickLeft: { left: -10, top: '50%', height: 1, width: 20 },
  tickRight: { right: -10, top: '50%', height: 1, width: 20 },
  fileIcon: {
    width: 58,
    height: 62,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  dropTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.text,
  },
  dropHint: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 0.3,
    color: colors.textMuted,
    marginTop: 4,
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 22,
  },
  badgeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.background,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 14,
  },
  spacer: { flexGrow: 1, minHeight: 48 },
  secondary: { marginTop: 16 },
});
