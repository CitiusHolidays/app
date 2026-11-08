import { waitingLabel, waitingWork } from './waiting';

describe('work waiting to reach the office', () => {
  it('counts pending items from both queues and leaves sent ones out', () => {
    const waiting = waitingWork([{ status: 'pending' }, { status: 'synced' }], [{ status: 'pending' }, { status: 'done' }]);
    expect(waiting).toEqual({ pending: 2, stuck: 0 });
    expect(waitingLabel(waiting)).toBe('2 waiting to send');
  });

  it('puts refused items first, since they need the tour manager', () => {
    expect(waitingLabel(waitingWork([{ status: 'needsAttention' }], [{ status: 'pending' }]))).toBe('1 needs a look');
    expect(waitingLabel(waitingWork([{ status: 'needsAttention' }], [{ status: 'needsAttention' }]))).toBe('2 need a look');
  });

  it('says nothing when the office has everything', () => {
    expect(waitingLabel(waitingWork([{ status: 'synced' }], [{ status: 'done' }]))).toBeNull();
  });
});
