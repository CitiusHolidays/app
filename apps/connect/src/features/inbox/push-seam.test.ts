import { routeForPush } from './push-seam';

describe('push seam', () => {
  it('routes a content-free push to the inbox detail', () => {
    expect(routeForPush({ notificationId: 'n_1' })).toEqual({ params: { id: 'n_1' }, pathname: '/notification/[id]' });
  });

  it('ignores a payload without a notification id', () => {
    expect(routeForPush({})).toBeNull();
    expect(routeForPush({ notificationId: 42 })).toBeNull();
  });
});
