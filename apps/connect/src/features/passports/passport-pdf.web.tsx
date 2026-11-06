/** Web preview: react-native-pdf has no web view, so PDF passports are not shown here. */
export function canShowPdf() {
  return false;
}

export function PassportPdf(_props: { name: string; onError: () => void; uri: string }) {
  return null;
}
