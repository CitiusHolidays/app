import { waitingLabel, waitingWork } from './waiting';

const count = (jobCardId: string, status: 'pending' | 'synced' | 'needsAttention') => ({ args: { jobCardId }, kind: 'headcountStop' as const, status });
const announcement = (jobCardId: string, status: 'pending' | 'synced' | 'needsAttention') => ({ args: { jobCardId }, kind: 'announcement' as const, status });
const expense = (jobCardId: string, status: 'pending' | 'done' | 'needsAttention') => ({ jobCardId, status });

describe('work waiting to reach the office', () => {
  it('counts pending items from both queues and leaves sent ones out', () => {
    const waiting = waitingWork([count('a', 'pending'), count('a', 'synced')], [expense('a', 'pending'), expense('a', 'done')], 'a');
    expect(waiting).toEqual({ pending: 2, place: 'headcount', single: false, stuck: 0 });
    expect(waitingLabel(waiting)).toBe('2 waiting to send');
  });

  it('puts refused items first, since they need the tour manager, and says what they are', () => {
    expect(waitingLabel(waitingWork([count('a', 'needsAttention')], [expense('a', 'pending')], 'a'))).toBe('1 headcount needs a look');
    expect(waitingLabel(waitingWork([], [expense('a', 'needsAttention'), expense('a', 'needsAttention')], 'a'))).toBe('2 expenses need a look');
    expect(waitingLabel(waitingWork([announcement('a', 'needsAttention'), count('a', 'needsAttention')], [], 'a'))).toBe('2 need a look');
  });

  it('opens the screen where the refused work is', () => {
    expect(waitingWork([count('a', 'pending')], [expense('a', 'needsAttention')], 'a').place).toBe('expenses');
    expect(waitingWork([announcement('a', 'needsAttention')], [], 'a').place).toBe('announcements');
  });

  it("counts only the selected trip's work", () => {
    const waiting = waitingWork([count('b', 'needsAttention')], [expense('b', 'needsAttention'), expense('a', 'pending')], 'a');
    expect(waiting).toEqual({ pending: 1, place: 'expenses', single: true, stuck: 0 });
    expect(waitingLabel(waiting)).toBe('1 expense waiting to send');
    expect(waitingLabel(waitingWork([count('b', 'pending')], [], null))).toBeNull();
  });

  it('says nothing when the office has everything', () => {
    expect(waitingLabel(waitingWork([count('a', 'synced')], [expense('a', 'done')], 'a'))).toBeNull();
  });
});
