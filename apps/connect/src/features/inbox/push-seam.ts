/**
 * Push notifications are not built yet (plan item P9: content-free pushes, provider decided in
 * spike Q6). When they are, this is the only place that changes:
 *
 * 1. `registerForPush` asks permission, gets the device token and sends it to a new Convex
 *    mutation (to be added on the website backend).
 * 2. A push carries only a notification id, never its text. `routeForPush` turns that id into
 *    the in-app route, so the inbox detail screen loads the content after sign-in.
 *
 * Until then both are inert, and the inbox reads `crm/activity:listNotifications` directly.
 */
export async function registerForPush(): Promise<'not-built'> {
  return 'not-built';
}

export function routeForPush(payload: { notificationId?: unknown }) {
  return typeof payload.notificationId === 'string' && payload.notificationId
    ? { params: { id: payload.notificationId }, pathname: '/notification/[id]' as const }
    : null;
}
