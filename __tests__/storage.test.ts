import { parseJson } from '../src/storage/appState';
import { runAll } from '../src/storage/reset';

jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('../src/native/NativeSpenddModels', () => ({}));
jest.mock('../src/native/NativeSpenddTransactions', () => ({}));
jest.mock('react-native-keychain', () => ({}));

it('parses saved JSON, falling back on damage', () => {
  expect(parseJson('{"a":1}', null)).toEqual({ a: 1 });
  for (const raw of [null, '', '{broken', '42', 'null', '"text"']) {
    expect(parseJson(raw, { fallback: true })).toEqual({ fallback: true });
  }
});

it('runs every reset step even when one fails, then reports the failure', async () => {
  const ran: string[] = [];
  const step = (name: string, fail = false) => async () => {
    ran.push(name);
    if (fail) {
      throw new Error(`${name} failed`);
    }
  };
  await expect(runAll([step('pin'), step('log', true), step('statement'), step('model')])).rejects.toThrow('log failed');
  expect(ran).toEqual(['pin', 'log', 'statement', 'model']);
  await expect(runAll([step('a'), step('b')])).resolves.toBeUndefined();
});
