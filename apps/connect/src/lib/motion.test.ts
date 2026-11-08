import { rollsUp } from './motion';

describe('rolling counts', () => {
  it('rolls up when the count grows or reaches everyone, and down when it shrinks', () => {
    expect(rollsUp('3', '4')).toBe(true);
    expect(rollsUp('13', 'All')).toBe(true);
    expect(rollsUp('4', '3')).toBe(false);
    expect(rollsUp('All', '13')).toBe(false);
  });
});
