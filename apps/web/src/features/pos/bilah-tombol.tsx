export type Tombol = { kunci: string; label: string };

/** Daftar tombol keyboard yang berlaku saat ini (selalu tampil di bawah layar POS, K-073). */
export function BilahTombol({ daftar }: { daftar: Tombol[] }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-slate-300"
      aria-label="Tombol keyboard"
    >
      {daftar.map((t) => (
        <span key={t.kunci + t.label} className="whitespace-nowrap">
          <kbd className="mr-1 rounded bg-slate-700 px-1.5 py-0.5 font-mono font-semibold text-white">
            {t.kunci}
          </kbd>
          {t.label}
        </span>
      ))}
    </div>
  );
}
