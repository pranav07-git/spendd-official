const mockHasGenericPassword = jest.fn();
jest.mock('react-native-keychain', () => ({ hasGenericPassword: (...args: unknown[]) => mockHasGenericPassword(...args) }));

import { hasPinWithRetry } from '../src/storage/secure';

beforeEach(() => mockHasGenericPassword.mockReset());

it('survives a keychain hiccup at startup', async () => {
  mockHasGenericPassword.mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce(true);
  await expect(hasPinWithRetry(3, 0)).resolves.toBe(true);
});

it('reports "no PIN" only after every try says so', async () => {
  mockHasGenericPassword.mockResolvedValue(false);
  await expect(hasPinWithRetry(3, 0)).resolves.toBe(false);
  expect(mockHasGenericPassword).toHaveBeenCalledTimes(3);
});

it('rejects instead of answering "no PIN" when the keychain keeps failing', async () => {
  mockHasGenericPassword.mockRejectedValue(new Error('unavailable'));
  await expect(hasPinWithRetry(3, 0)).rejects.toThrow('unavailable');
});
