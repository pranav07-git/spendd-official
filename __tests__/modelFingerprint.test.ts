import { fingerprintOf, isStillVerified } from '../src/insights/modelFingerprint';

const verified = { enabled: true, verified: true, fingerprint: { size: 100, modifiedAt: 5 } };

it('trusts the verified file only while its size and modified time are unchanged', () => {
  expect(isStillVerified(verified, { size: 100, modifiedAt: 5 })).toBe(true);
  expect(isStillVerified(verified, { size: 101, modifiedAt: 5 })).toBe(false);
  expect(isStillVerified(verified, { size: 100, modifiedAt: 6 })).toBe(false);
  expect(isStillVerified(verified, null)).toBe(false);
});

it('re-verifies files checked before fingerprints existed, or never verified', () => {
  expect(isStillVerified({ enabled: true, verified: true }, { size: 100, modifiedAt: 5 })).toBe(false);
  expect(isStillVerified({ ...verified, verified: false }, { size: 100, modifiedAt: 5 })).toBe(false);
});

it('reads the fingerprint from the native status', () => {
  expect(fingerprintOf({ downloadedBytes: 100, modifiedAt: 5 })).toEqual({ size: 100, modifiedAt: 5 });
  expect(fingerprintOf({ downloadedBytes: 100 })).toBeNull();
  expect(fingerprintOf({ downloadedBytes: 0, modifiedAt: 5 })).toBeNull();
});
