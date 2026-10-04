/** Rejects repeated (1111) and straight-run (1234, 9876) PINs. */
export function isTooSimple(pin: string) {
  const digits = pin.split('').map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]);
  return steps.every(s => s === steps[0]) && Math.abs(steps[0]) <= 1;
}
