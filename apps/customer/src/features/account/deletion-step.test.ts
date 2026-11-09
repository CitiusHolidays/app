import { deletionStep, type DeletionCheck } from './deletion-step';

const online = { offline: false, profileLoaded: true };
const answer = (value: Extract<DeletionCheck, { kind: 'answer' }>['value']): DeletionCheck => ({ kind: 'answer', value });

describe('deletionStep', () => {
  it('waits for both the check and the profile', () => {
    expect(deletionStep({ kind: 'loading' }, online)).toBe('loading');
    expect(deletionStep(answer({ status: 'staff_account' }), { ...online, profileLoaded: false })).toBe('loading');
  });

  it('says it is offline instead of waiting forever', () => {
    expect(deletionStep({ kind: 'loading' }, { offline: true, profileLoaded: true })).toBe('offline');
  });

  it('passes failures through', () => {
    expect(deletionStep({ kind: 'error' }, online)).toBe('error');
    expect(deletionStep({ kind: 'unavailable' }, online)).toBe('unavailable');
  });

  it('maps each server answer to its step', () => {
    expect(deletionStep(answer({ status: 'staff_account' }), online)).toBe('staff');
    expect(deletionStep(answer({ reauthenticateBy: 1, status: 'ready' }), online)).toBe('ready');
    expect(deletionStep(answer({ status: 'reauthentication_required' }), online)).toBe('reauth');
    expect(deletionStep(answer(null), online)).toBe('reauth');
  });
});
