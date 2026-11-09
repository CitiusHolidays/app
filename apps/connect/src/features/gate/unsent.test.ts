import { signOutWarning, syncStatus, unsentWork } from './unsent';

const field = [
  { kind: 'headcountStop' as const, status: 'pending' as const },
  { kind: 'announcement' as const, status: 'needsAttention' as const },
  { kind: 'headcountStop' as const, status: 'synced' as const },
];
const expenses = [{ status: 'pending' as const }, { status: 'pending' as const }, { status: 'done' as const }];

describe('unsent work', () => {
  it('counts what has not reached the office, by kind', () => {
    expect(unsentWork(field, expenses)).toEqual({
      announcements: 1,
      expenses: 2,
      headcounts: 1,
      refused: { expenses: 0, field: 1 },
    });
  });

  it('warns about headcounts and announcements before sign-out deletes them, not only expenses', () => {
    expect(signOutWarning(unsentWork(field, expenses))).toBe(
      'Not sent to the office yet: 2 expenses, 1 headcount and 1 announcement. Signing out deletes them, with the receipt photos, from this phone.'
    );
    expect(signOutWarning(unsentWork([{ kind: 'announcement', status: 'pending' }], []))).toBe(
      'Not sent to the office yet: 1 announcement. Signing out deletes it from this phone.'
    );
    expect(signOutWarning(unsentWork([], []))).toBe(
      'Signing out deletes the saved trip packs, headcounts and announcements from this phone.'
    );
  });

  it('gives one sync status for expenses, headcounts and announcements', () => {
    expect(syncStatus(unsentWork(field, expenses))).toMatchObject({ kind: 'attention' });
    expect(syncStatus(unsentWork([{ kind: 'headcountStop', status: 'pending' }], []))).toEqual({
      kind: 'neutral',
      label: 'Waiting',
      text: 'Waiting to send: 1 headcount.',
    });
    expect(syncStatus(unsentWork([], []))).toMatchObject({ kind: 'good', label: 'All sent' });
  });
});
