import type {
  BagianLaporan,
  BarisIkhtisar,
  BarisTabelLaporan,
  DokumenLaporan,
  KolomLaporan,
  SelLaporan,
  TabelLaporan,
  TampilanToko,
} from '@sit/shared';
import { formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { rataKolom, teksPengurang, teksSel, WARNA_NADA } from './format-laporan';

/*
 * Dokumen laporan formal (K-078), dipakai untuk pratinjau di layar dan untuk cetak/PDF:
 * kop toko bergaris ganda, judul kapital, periode & satuan mata uang, ikhtisar bergaya laporan keuangan,
 * tabel bergaris dengan header dua tingkat, catatan bernomor, dan kolom tanda tangan.
 */

function Kop({ toko }: { toko: TampilanToko }) {
  const kontak = [toko.alamatToko, toko.telpToko && `Telp. ${toko.telpToko}`, toko.emailToko]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex items-center gap-4 border-b-[3px] border-double border-slate-900 pb-3">
      {toko.logo && <img src={toko.logo} alt="" className="size-14 object-contain" />}
      <div className="min-w-0">
        <div className="text-lg leading-tight font-bold text-slate-900">{toko.namaToko}</div>
        <div className="font-semibold text-slate-800">{toko.namaBadanUsaha}</div>
        {kontak && <div className="text-[11px] text-slate-600">{kontak}</div>}
      </div>
    </div>
  );
}

function IsiSel({ s }: { s: SelLaporan }) {
  if (s.j !== 'teks') return <>{teksSel(s)}</>;
  return (
    <span
      className={cn(
        s.tebal && 'font-semibold',
        s.mono && 'font-mono text-[0.92em] whitespace-nowrap',
        s.nada && WARNA_NADA[s.nada],
      )}
    >
      {s.v}
    </span>
  );
}

function Info({ pasangan }: { pasangan: { label: string; nilai: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-10 gap-y-1 rounded-sm border border-slate-300 px-4 py-3">
      {pasangan.map((p) => (
        <div key={p.label} className="flex gap-2">
          <dt className="w-36 shrink-0 text-slate-600">{p.label}</dt>
          <dd className="min-w-0 font-medium">: {p.nilai}</dd>
        </div>
      ))}
    </dl>
  );
}

function Ikhtisar({ baris }: { baris: BarisIkhtisar[] }) {
  return (
    <table className="w-full max-w-[620px]">
      <tbody>
        {baris.map((b, i) => {
          const gaya = b.gaya ?? 'biasa';
          const nilai = b.nilai
            ? gaya === 'kurang'
              ? teksPengurang(b.nilai)
              : teksSel(b.nilai)
            : '';
          return (
            <tr key={i}>
              <td
                className={cn(
                  'py-0.5 pr-4',
                  gaya === 'judul' && 'pt-2 font-semibold',
                  gaya === 'subtotal' && 'font-semibold',
                  gaya === 'total' && 'font-bold',
                )}
                style={{ paddingLeft: `${(b.tingkat ?? 0) * 1.25}rem` }}
              >
                {b.label}
              </td>
              <td
                className={cn(
                  'w-40 py-0.5 text-right tabular-nums',
                  gaya === 'subtotal' && 'border-t border-slate-500 font-semibold',
                  gaya === 'total' &&
                    'border-t border-b-[3px] border-t-slate-900 border-b-slate-900 border-double font-bold',
                )}
              >
                {nilai}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Indeks kolom pertama setelah sel-sel kosong di awal (wilayah label subtotal/total). */
function rentangLabel(b: BarisTabelLaporan): number {
  let i = 0;
  while (i < b.sel.length && b.sel[i]!.j === 'kosong') i++;
  return Math.max(1, i);
}

function KepalaTabel({ kolom }: { kolom: KolomLaporan[] }) {
  const adaGrup = kolom.some((k) => k.grup);
  const kelas =
    'border border-slate-400 bg-slate-100 px-1.5 py-1 text-center align-middle text-[0.92em] font-semibold';
  if (!adaGrup) {
    return (
      <thead>
        <tr>
          {kolom.map((k, i) => (
            <th key={i} className={kelas}>
              {k.judul}
            </th>
          ))}
        </tr>
      </thead>
    );
  }
  const atas: { label: string; span: number; grup: boolean }[] = [];
  for (const k of kolom) {
    const akhir = atas.at(-1);
    if (k.grup && akhir?.grup && akhir.label === k.grup) akhir.span++;
    else atas.push({ label: k.grup ?? k.judul, span: 1, grup: !!k.grup });
  }
  return (
    <thead>
      <tr>
        {atas.map((a, i) => (
          <th key={i} className={kelas} colSpan={a.grup ? a.span : 1} rowSpan={a.grup ? 1 : 2}>
            {a.label}
          </th>
        ))}
      </tr>
      <tr>
        {kolom.map((k, i) =>
          k.grup ? (
            <th key={i} className={kelas}>
              {k.judul}
            </th>
          ) : null,
        )}
      </tr>
    </thead>
  );
}

function Tabel({ t }: { t: TabelLaporan }) {
  const lebarTotal = t.kolom.reduce((a, k) => a + k.lebar, 0);
  const adaData = t.baris.some((b) => b.gaya === 'data');
  return (
    <table className="w-full border-collapse">
      <colgroup>
        {t.kolom.map((k, i) => (
          <col key={i} style={{ width: `${((k.lebar / lebarTotal) * 100).toFixed(2)}%` }} />
        ))}
      </colgroup>
      <KepalaTabel kolom={t.kolom} />
      <tbody>
        {!adaData && t.kosong && (
          <tr>
            <td
              colSpan={t.kolom.length}
              className="border border-slate-300 px-2 py-3 text-center text-slate-500 italic"
            >
              {t.kosong}
            </td>
          </tr>
        )}
        {t.baris.map((b, i) => {
          if (b.gaya === 'grup') {
            return (
              <tr key={i}>
                <td
                  colSpan={t.kolom.length}
                  className="border border-slate-300 bg-slate-50 px-1.5 py-1 font-semibold"
                >
                  {b.label}
                </td>
              </tr>
            );
          }
          const tebal = b.gaya === 'subtotal' || b.gaya === 'total';
          const garis = cn(
            'border-x border-slate-300 px-1.5 py-[3px] align-top',
            b.gaya === 'data' && 'border-b border-b-slate-200',
            b.gaya === 'subtotal' &&
              'border-t border-b border-t-slate-500 border-b-slate-300 bg-slate-50 font-semibold',
            b.gaya === 'total' &&
              'border-t border-b-[3px] border-t-slate-900 border-b-slate-900 border-double bg-slate-50 font-bold',
          );
          const awal = b.label !== undefined ? rentangLabel(b) : 0;
          return (
            <tr key={i} className="break-inside-avoid">
              {b.label !== undefined && (
                <td
                  colSpan={awal}
                  className={cn(garis, b.gaya === 'data' ? 'italic' : 'text-right')}
                >
                  {b.label}
                </td>
              )}
              {b.sel.slice(awal).map((s, j) => {
                const k = t.kolom[awal + j];
                return (
                  <td
                    key={j}
                    className={cn(
                      garis,
                      k && rataKolom(k.jenis),
                      s.j !== 'teks' && 'tabular-nums whitespace-nowrap',
                      tebal && 'font-semibold',
                    )}
                  >
                    <IsiSel s={s} />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Bagian({ b }: { b: BagianLaporan }) {
  return (
    // Tabel panjang boleh terpotong antarhalaman (header berulang); blok kecil tidak dipotong.
    <section className={cn('mt-5', b.jenis !== 'tabel' && 'break-inside-avoid')}>
      {b.judul && (
        <h2 className="mb-1.5 text-[0.95em] font-bold text-slate-900 break-after-avoid">
          {b.judul}
        </h2>
      )}
      {b.jenis === 'info' && <Info pasangan={b.pasangan} />}
      {b.jenis === 'ikhtisar' && <Ikhtisar baris={b.baris} />}
      {b.jenis === 'tabel' && <Tabel t={b.tabel} />}
    </section>
  );
}

export function DokumenLaporanFormal({
  d,
  toko,
  cetak = false,
}: {
  d: DokumenLaporan;
  toko: TampilanToko;
  cetak?: boolean;
}) {
  return (
    <article
      className={cn(
        'dokumen-laporan bg-white text-[12.5px] leading-snug text-slate-900',
        !cetak && 'mx-auto border border-slate-200 px-10 py-9 shadow-sm',
        !cetak && (d.orientasi === 'lanskap' ? 'max-w-[1180px]' : 'max-w-[900px]'),
      )}
      data-testid="dokumen-laporan"
    >
      <Kop toko={toko} />
      <header className="my-4 text-center">
        <h1 className="text-[1.15em] font-bold tracking-[0.12em] uppercase">{d.judul}</h1>
        {d.subjudul.map((s) => (
          <p key={s} className="text-[0.92em] text-slate-700">
            {s}
          </p>
        ))}
      </header>
      {d.bagian.map((b, i) => (
        <Bagian key={i} b={b} />
      ))}
      {d.catatan.length > 0 && (
        <section className="mt-5 break-inside-avoid text-[0.85em] text-slate-600">
          <div className="font-semibold text-slate-800">Catatan atas laporan:</div>
          <ol className="list-decimal space-y-0.5 pl-5">
            {d.catatan.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </section>
      )}
      {d.tandaTangan.length > 0 && (
        <section className="mt-8 break-inside-avoid">
          <p className="text-[0.85em] text-slate-600">
            Disusun pada {formatWaktu(d.disusunPada)} WIB
          </p>
          <div
            className="mt-3 grid gap-8 text-center"
            style={{
              gridTemplateColumns: `repeat(${Math.max(2, d.tandaTangan.length)}, minmax(0, 1fr))`,
            }}
          >
            {d.tandaTangan.length === 1 && <div />}
            {d.tandaTangan.map((t) => (
              <div key={t.label}>
                <div>{t.label},</div>
                <div className="font-semibold">{t.jabatan}</div>
                <div className="h-16" />
                <div className="inline-block min-w-44 border-t border-slate-900 pt-1">
                  {t.nama ?? ' '}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
