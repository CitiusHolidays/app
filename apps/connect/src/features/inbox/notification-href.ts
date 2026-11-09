/** The detail screen for one notification: opened from the inbox and from Today. */
export const notificationHref = (id: string) => ({ params: { id }, pathname: '/notification/[id]' as const });
