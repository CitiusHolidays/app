import { formatMoney, parseAmount } from './format';

describe('expense amounts', () => {
  it('accepts positive amounts with up to two decimals and thousands separators', () => {
    expect(parseAmount('1,250.50')).toBe(1250.5);
    expect(parseAmount(' 80 ')).toBe(80);
  });

  it('rejects zero, negatives, words and extra decimals', () => {
    for (const text of ['0', '-5', 'abc', '12.345', '', '1.2.3']) {
      expect(parseAmount(text)).toBeNull();
    }
  });

  it('formats in the expense currency', () => {
    expect(formatMoney(1250.5, 'THB', 'en-GB')).toMatch(/^THB\s1,250\.50$/);
  });
});
