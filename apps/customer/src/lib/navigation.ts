import { router } from 'expo-router';

/** Leaves this screen: back where there is somewhere to go back to, else to Journeys (a cold start from a link). */
export function closeScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
