import {
  attemptMessage,
  attemptPin,
  constantTimeEqual,
  lockDurationMs,
  NO_LOCKOUT,
  parseLockout,
  type LockoutState,
  type LockoutStore,
} from '../src/storage/pinLockout';

/** A store that, like the keychain, outlives any one screen (or app run). */
function memoryStore(initial: LockoutState = NO_LOCKOUT) {
  let state = initial;
  const saves: LockoutState[] = [];
  const store: LockoutStore = {
    load: async () => state,
    save: async next => {
      state = next;
      saves.push(next);
    },
  };
  return { store, saves, get: () => state };
}

const correct = async (pin: string) => pin === '4826';

it('counts down attempts, then locks for 30 s', async () => {
  const { store } = memoryStore();
  const now = () => 1_000;
  const messages = [];
  for (let i = 0; i < 5; i++) {
    const result = await attemptPin('0000', correct, store, now);
    expect(result.ok).toBe(false);
    messages.push(attemptMessage(result as Exclude<typeof result, { ok: true }>));
  }
  expect(messages).toEqual([
    'Incorrect PIN. 4 attempts left.',
    'Incorrect PIN. 3 attempts left.',
    'Incorrect PIN. 2 attempts left.',
    'Incorrect PIN. 1 attempt left.',
    'Too many attempts. Try again in 30s.',
  ]);
});

it('keeps the lock across restarts and refuses even the right PIN while locked', async () => {
  const { store } = memoryStore({ failures: 5, lockedUntil: 31_000 });
  // A fresh "app run": nothing in memory, only the persisted state.
  const result = await attemptPin('4826', correct, store, () => 21_000);
  expect(result).toEqual({ ok: false, lockedForMs: 10_000 });
  expect(attemptMessage(result as { ok: false; lockedForMs: number })).toBe('Too many attempts. Try again in 10s.');
});

it('escalates each wrong PIN after the first lock, capped at an hour', async () => {
  expect([4, 5, 6, 7, 8, 12, 50].map(lockDurationMs)).toEqual([0, 30_000, 60_000, 120_000, 240_000, 3_600_000, 3_600_000]);
  const { store, get } = memoryStore({ failures: 5, lockedUntil: 31_000 });
  const result = await attemptPin('0000', correct, store, () => 40_000);
  expect(result).toEqual({ ok: false, lockedForMs: 60_000 });
  expect(get()).toEqual({ failures: 6, lockedUntil: 100_000 });
});

it('counts the attempt before the PIN is checked', async () => {
  const { store, saves } = memoryStore();
  let seenBeforeCheck: LockoutState | undefined;
  await attemptPin(
    '4826',
    async pin => {
      seenBeforeCheck = saves[saves.length - 1];
      return correct(pin);
    },
    store,
  );
  expect(seenBeforeCheck).toEqual({ failures: 1, lockedUntil: 0 });
});

it('a correct PIN clears the count', async () => {
  const { store, get } = memoryStore({ failures: 3, lockedUntil: 0 });
  expect(await attemptPin('4826', correct, store)).toEqual({ ok: true });
  expect(get()).toEqual(NO_LOCKOUT);
});

it('reads damaged lockout data as no lockout', () => {
  expect(parseLockout('{"failures":2,"lockedUntil":99}')).toEqual({ failures: 2, lockedUntil: 99 });
  for (const raw of [null, '', 'not json', '{"failures":"x","lockedUntil":-5}', '[]']) {
    expect(parseLockout(raw)).toEqual(NO_LOCKOUT);
  }
});

it('compares PINs exactly', () => {
  expect(constantTimeEqual('4826', '4826')).toBe(true);
  for (const [a, b] of [['4826', '4827'], ['4826', '482'], ['', '0'], ['4826', '48260']]) {
    expect(constantTimeEqual(a, b)).toBe(false);
  }
});
