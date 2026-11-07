/** Initials for a name: "Aanya Testguest" -> "AT". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : parts.slice(0, 1);
  return letters
    .map((part) => part?.[0] ?? '')
    .join('')
    .toUpperCase();
}
