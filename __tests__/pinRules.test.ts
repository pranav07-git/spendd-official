import { isTooSimple } from '../src/pinRules';

test('rejects repeated and sequential PINs', () => {
  for (const pin of ['0000', '1111', '1234', '6789', '9876', '3210']) {
    expect(isTooSimple(pin)).toBe(true);
  }
});

test('accepts other PINs', () => {
  for (const pin of ['1357', '2580', '1122', '4826', '1235']) {
    expect(isTooSimple(pin)).toBe(false);
  }
});
