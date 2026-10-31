/** Pesan galat per kolom dari isu Zod (kolom terdalam). */
export type Galat = Record<string, string | undefined>;

export function galatDari(issues: { path: PropertyKey[]; message: string }[]): Galat {
  const g: Galat = {};
  for (const i of issues) {
    const k = String(i.path[i.path.length - 1] ?? '');
    g[k] ??= i.message;
  }
  return g;
}
