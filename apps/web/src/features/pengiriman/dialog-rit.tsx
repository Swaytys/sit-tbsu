import type { BarisSuratJalan, Perjalanan } from '@sit/shared';
import { CalendarPlus, Truck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useBerangkatRit,
  useDaftarKendaraan,
  useDaftarSopir,
  useRencanaRit,
  useUbahRit,
} from '@/api/armada';
import { pesanGalat } from '@/api/client';
import { useTampilanToko } from '@/api/pengaturan';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PanelMuatan } from '../pengantaran/panel-muatan';
import { tandaSurat } from '../armada/tanda-surat';

const kelasPilih =
  'h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

const dua = (n: number) => String(n).padStart(2, '0');
const keIsian = (d: Date) =>
  `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}T${dua(d.getHours())}:${dua(d.getMinutes())}`;

/** Nilai awal isian jadwal: satu jam lagi, dibulatkan ke 30 menit (waktu lokal peramban = WIB di toko). */
function jadwalAwal(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return keIsian(d);
}

/**
 * K-160: rencanakan rit (kendaraan, sopir, jadwal). Kendaraan yang sedang jalan boleh direncanakan untuk nanti.
 * `onDibuat` dipakai dialog surat jalan (K-174) agar rit yang baru dibuat langsung terpilih.
 */
export function DialogRitBaru({
  onTutup,
  onDibuat,
  ubah,
}: {
  onTutup: () => void;
  onDibuat?: (r: Perjalanan) => void;
  /** K-203: rit yang belum berangkat diubah kendaraan, sopir, atau jadwalnya. */
  ubah?: Perjalanan;
}) {
  const kendaraan = useDaftarKendaraan('AKTIF');
  const sopir = useDaftarSopir('AKTIF');
  const rencana = useRencanaRit();
  const simpanUbah = useUbahRit();
  const [idKendaraan, setIdKendaraan] = useState(ubah ? String(ubah.idKendaraan) : '');
  const [idSopir, setIdSopir] = useState(ubah ? String(ubah.idSopir) : '');
  const [jadwal, setJadwal] = useState(() =>
    ubah?.jadwalBerangkat ? keIsian(new Date(ubah.jadwalBerangkat)) : jadwalAwal(),
  );
  const [catatan, setCatatan] = useState(ubah?.catatan ?? '');
  const menyimpan = rencana.isPending || simpanUbah.isPending;

  function kirim() {
    if (!idKendaraan || !idSopir || !jadwal) {
      toast.error(
        !idKendaraan ? 'Pilih kendaraan.' : !idSopir ? 'Pilih sopir.' : 'Isi jadwal berangkat.',
      );
      return;
    }
    if (ubah) {
      simpanUbah
        .mutateAsync({
          id: ubah.id,
          json: {
            idKendaraan: Number(idKendaraan),
            idSopir: Number(idSopir),
            jadwalBerangkat: new Date(jadwal).toISOString(),
          },
        })
        .then((r) => {
          toast.success(`Rit ${r.nomor} diubah: ${r.plat}, sopir ${r.namaSopir}.`);
          onTutup();
        })
        .catch((err: unknown) => toast.error(pesanGalat(err)));
      return;
    }
    rencana
      .mutateAsync({
        idKendaraan: Number(idKendaraan),
        idSopir: Number(idSopir),
        jadwalBerangkat: new Date(jadwal).toISOString(),
        catatan: catatan.trim() || null,
      })
      .then((r) => {
        toast.success(
          onDibuat
            ? `Rit ${r.nomor} direncanakan.`
            : `Rit ${r.nomor} direncanakan. Seret order kirim ke grupnya.`,
        );
        onDibuat?.(r);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent
        className="sm:max-w-md"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            kirim();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{ubah ? `Ubah rit ${ubah.nomor}` : 'Rit baru'}</DialogTitle>
          <DialogDescription>
            {ubah
              ? 'Ganti kendaraan (mis. ternyata terlalu kecil), sopir, atau jadwal. Surat jalannya ikut berganti. Bisa selama rit belum berangkat.'
              : 'Satu rit = satu kendaraan + satu sopir berangkat sekali. Isi dengan order kirim setelah dibuat.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="font-medium">Kendaraan</span>
            <select
              autoFocus
              className={kelasPilih}
              value={idKendaraan}
              onChange={(e) => setIdKendaraan(e.target.value)}
              aria-label="Kendaraan rit"
            >
              <option value="">— pilih kendaraan —</option>
              {(kendaraan.data ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.plat} · {k.jenis}
                  {tandaSurat(k)}
                  {k.kapasitasKg ? ` · ${k.kapasitasKg.toLocaleString('id-ID')} kg` : ''}
                  {k.sedangJalan ? ` (sekarang di jalan: ${k.sedangJalan.nomor})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-medium">Sopir</span>
            <select
              className={kelasPilih}
              value={idSopir}
              onChange={(e) => setIdSopir(e.target.value)}
              aria-label="Sopir rit"
            >
              <option value="">— pilih sopir —</option>
              {(sopir.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                  {s.sedangJalan ? ` (sekarang di jalan: ${s.sedangJalan.nomor})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-medium">Jadwal berangkat</span>
            <Input
              type="datetime-local"
              value={jadwal}
              onChange={(e) => setJadwal(e.target.value)}
              aria-label="Jadwal berangkat"
            />
          </label>
          {!ubah && (
            <Input
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan (opsional), mis. rute Peterongan–Jombang kota"
              aria-label="Catatan rit"
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button disabled={menyimpan} onClick={kirim}>
            <CalendarPlus />{' '}
            {menyimpan ? 'Menyimpan…' : ubah ? 'Simpan perubahan (Enter)' : 'Buat rit (Enter)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type CaraCetakRit = 'CETAK' | 'PDF' | 'NANTI';

const PILIHAN_CETAK: { nilai: CaraCetakRit; kunci: string; label: string; ket: string }[] = [
  { nilai: 'CETAK', kunci: '1', label: 'Cetak', ket: 'ke printer' },
  { nilai: 'PDF', kunci: '2', label: 'Simpan PDF', ket: 'pilih "Simpan sebagai PDF"' },
  { nilai: 'NANTI', kunci: '3', label: 'Tidak sekarang', ket: 'cetak nanti dari kartu rit' },
];

/**
 * K-160/K-161/K-174: berangkatkan rit rencana; muatan dicek ulang (alasan bila perlu, ditolak bila melebihi).
 * Semua surat jalan rit dicetak atau disimpan PDF sekaligus setelah berangkat, sesuai pilihan di dialog
 * (bawaan dari Pengaturan › Dokumen & kertas).
 */
export function DialogBerangkatRit({
  rit,
  isi,
  onTutup,
  onCetak,
}: {
  rit: Perjalanan;
  isi: BarisSuratJalan[];
  onTutup: () => void;
  onCetak: (daftar: BarisSuratJalan[], cara: Exclude<CaraCetakRit, 'NANTI'>) => void;
}) {
  const berangkat = useBerangkatRit();
  const modeCetak = useTampilanToko().data?.suratJalanCetak;
  const [cara, setCara] = useState<CaraCetakRit | null>(null);
  const caraAktif: CaraCetakRit = cara ?? (modeCetak === 'TIDAK' ? 'NANTI' : 'CETAK');
  const [alasan, setAlasan] = useState('');
  const m = rit.muatan;
  const ditolak = m?.kesimpulan === 'DITOLAK';
  const perluAlasan = m?.kesimpulan === 'KONFIRMASI';

  function kirim() {
    if (perluAlasan && alasan.trim().length < 10) {
      toast.error('Tulis alasan kenapa muatan tetap aman (minimal 10 huruf).');
      return;
    }
    if (berangkat.isPending || ditolak) return;
    berangkat
      .mutateAsync({ id: rit.id, alasanMuatan: perluAlasan ? alasan.trim() : null })
      .then((r) => {
        toast.success(`${r.nomor} berangkat: ${r.plat}, sopir ${r.namaSopir}.`);
        onTutup();
        if (caraAktif !== 'NANTI' && isi.length > 0) onCetak(isi, caraAktif);
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent
        className="sm:max-w-lg"
        onKeyDown={(e) => {
          if (e.target instanceof HTMLTextAreaElement) return;
          const pilih = PILIHAN_CETAK.find((p) => p.kunci === e.key);
          if (pilih) {
            e.preventDefault();
            setCara(pilih.nilai);
          } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            kirim();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Berangkatkan {rit.nomor}</DialogTitle>
          <DialogDescription>
            {rit.plat} · sopir {rit.namaSopir} · {isi.length} surat jalan. Semua surat jalan menjadi{' '}
            <b>Di jalan</b>; kendaraan dan sopir terkunci sampai hasilnya dicatat.
          </DialogDescription>
        </DialogHeader>
        {m && <PanelMuatan m={m} />}
        {perluAlasan && (
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-orange-800">
              Alasan muatan tetap aman (wajib, tercatat)
            </span>
            <textarea
              autoFocus
              rows={2}
              maxLength={500}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Urut kejadiannya, mis. ditumpuk satu lapis di atas dinding bak, diikat, ditutup terpal; sudah dicek sopir."
              className="rounded-md border border-orange-300 px-2 py-1"
              aria-label="Alasan muatan rit"
            />
          </label>
        )}
        <fieldset className="grid gap-1.5 text-sm">
          <legend className="mb-1 font-medium">Surat jalan ({isi.length}) setelah berangkat</legend>
          <div
            className="grid grid-cols-3 gap-1.5"
            role="radiogroup"
            aria-label="Cetak surat jalan"
          >
            {PILIHAN_CETAK.map((p) => (
              <button
                key={p.nilai}
                type="button"
                role="radio"
                aria-checked={caraAktif === p.nilai}
                onClick={() => setCara(p.nilai)}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-left',
                  caraAktif === p.nilai
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                    : 'border-slate-300 hover:bg-slate-50',
                )}
              >
                <span className="font-medium">
                  <kbd className="mr-1 rounded bg-slate-800 px-1 font-mono text-xs text-white">
                    {p.kunci}
                  </kbd>
                  {p.label}
                </span>
                <span className="block text-xs text-slate-500">{p.ket}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button
            disabled={berangkat.isPending || ditolak}
            onClick={kirim}
            autoFocus={!perluAlasan}
          >
            <Truck /> {berangkat.isPending ? 'Menyimpan…' : 'Berangkat (Enter)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
