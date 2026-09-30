/**
 * Selisih dua versi data master untuk log aktivitas (docs/04 §8: "nilai lama → baru").
 * Hanya kolom di `baru` yang dibandingkan; nilai dianggap sama bila hasil JSON-nya sama.
 */
export function selisih<T extends Record<string, unknown>>(
  lama: T,
  baru: Partial<T>,
): { kolom: string[]; dataLama: Record<string, unknown>; dataBaru: Record<string, unknown> } {
  const kolom = Object.keys(baru).filter(
    (k) => baru[k] !== undefined && JSON.stringify(lama[k]) !== JSON.stringify(baru[k]),
  );
  return {
    kolom,
    dataLama: Object.fromEntries(kolom.map((k) => [k, lama[k] ?? null])),
    dataBaru: Object.fromEntries(kolom.map((k) => [k, baru[k] ?? null])),
  };
}
