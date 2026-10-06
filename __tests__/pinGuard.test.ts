const mockStore = new Map<string, string>();

jest.mock('react-native-keychain', () => ({
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'AES_GCM_NO_AUTH' },
  ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'BiometryCurrentSet' },
  setGenericPassword: jest.fn(async (_user: string, password: string, opts: { service: string }) => {
    mockStore.set(opts.service, password);
    return { service: opts.service };
  }),
  getGenericPassword: jest.fn(async (opts: { service: string }) =>
    mockStore.has(opts.service) ? { username: 'spendd', password: mockStore.get(opts.service)! } : false,
  ),
  resetGenericPassword: jest.fn(async (opts: { service: string }) => mockStore.delete(opts.service)),
  hasGenericPassword: jest.fn(async (opts: { service: string }) => mockStore.has(opts.service)),
}));

import { checkPin, pinCheckMessage, savePin } from '../src/storage/secure';

const T0 = 1_000_000;

beforeEach(async () => {
  mockStore.clear();
  await savePin('2580');
});

describe('PIN lockout', () => {
  it('allows five wrong PINs, then locks for 30 s', async () => {
    for (let i = 1; i <= 4; i++) {
      expect(await checkPin('0000', T0)).toEqual({ ok: false, attemptsLeft: 5 - i, lockedForMs: 0 });
    }
    const fifth = await checkPin('0000', T0);
    expect(fifth).toEqual({ ok: false, attemptsLeft: 0, lockedForMs: 30_000 });
    // Even the right PIN is refused while locked.
    expect((await checkPin('2580', T0 + 10_000)).ok).toBe(false);
  });

  it('keeps the count in storage, so restarting the app doesn’t reset it', async () => {
    for (let i = 0; i < 5; i++) {
      await checkPin('0000', T0);
    }
    // A fresh copy of the module (as after a restart) still sees the lockout.
    let fresh!: typeof import('../src/storage/secure');
    jest.isolateModules(() => {
      fresh = require('../src/storage/secure');
    });
    expect(await fresh.checkPin('2580', T0 + 1_000)).toMatchObject({ ok: false, lockedForMs: 29_000 });
  });

  it('locks for longer with every further wrong PIN', async () => {
    let now = T0;
    for (let i = 0; i < 5; i++) {
      await checkPin('0000', now);
    }
    const waits = [];
    for (let i = 0; i < 5; i++) {
      now += 61 * 60_000; // past any lockout
      const result = await checkPin('0000', now);
      waits.push(result.ok ? 0 : result.lockedForMs);
    }
    expect(waits).toEqual([60_000, 300_000, 900_000, 3_600_000, 3_600_000]);
  });

  it('resets after the right PIN', async () => {
    await checkPin('0000', T0);
    await checkPin('0000', T0);
    expect(await checkPin('2580', T0)).toEqual({ ok: true });
    expect(await checkPin('0000', T0)).toMatchObject({ attemptsLeft: 4 });
  });

  it('words the messages', () => {
    expect(pinCheckMessage({ ok: false, attemptsLeft: 1, lockedForMs: 0 })).toBe('Incorrect PIN. 1 attempt left.');
    expect(pinCheckMessage({ ok: false, attemptsLeft: 0, lockedForMs: 300_000 })).toBe('Too many attempts. Try again in 5 min.');
  });
});
