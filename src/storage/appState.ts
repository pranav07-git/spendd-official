import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  setupComplete: 'spendd.setupComplete',
  consent: 'spendd.consent',
  statement: 'spendd.statement',
};

export type ImportedStatement = {
  name: string;
  size: number | null;
  type: string | null;
  localUri: string;
  importedAt: string;
};

export async function isSetupComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.setupComplete)) === 'true';
}

export async function markSetupComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.setupComplete, 'true');
}

export async function saveConsent(): Promise<void> {
  await AsyncStorage.setItem(
    KEYS.consent,
    JSON.stringify({ acceptedAt: new Date().toISOString() }),
  );
}

export async function saveStatement(statement: ImportedStatement): Promise<void> {
  await AsyncStorage.setItem(KEYS.statement, JSON.stringify(statement));
}

export async function getStatement(): Promise<ImportedStatement | null> {
  const raw = await AsyncStorage.getItem(KEYS.statement);
  return raw ? (JSON.parse(raw) as ImportedStatement) : null;
}

export async function clearAppState(): Promise<void> {
  await AsyncStorage.removeMany(Object.values(KEYS));
}
