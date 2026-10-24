import type { BarisSuratJalan } from '@sit/shared';
import { Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useBerangkat, useDaftarKendaraan, useDaftarSopir, usePratinjauMuatan } from '@/api/armada';
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
import { formatWaktu } from '@/lib/format';
import { PanelMuatan } from './panel-muatan';
import { tandaSurat } from '../armada/tanda-surat';

const kelasPilih =
  'h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

/**
 * S9 (K-150): memberangkatkan satu atau lebih surat jalan dengan kendaraan dan sopir dari data master.
 * Yang sedang jalan tampil tetapi tidak bisa dipilih, beserta nomor perjalanannya.
 */
export function DialogBerangkat({
  suratJalan,
  onTutup,
  onSelesai,
}: {
  suratJalan: BarisSuratJalan[];
  onTutup: () => void;
  onSelesai?: () => void;
}) {
  const kendaraan = useDaftarKendaraan('AKTIF');
  const sopir = useDaftarSopir('AKTIF');
  const berangkat = useBerangkat();
  const [idKendaraan, setIdKendaraan] = useState('');
  const [idSopir, setIdSopir] = useState('');
  const [catatan, setCatatan] = useState('');
  const [alasan, setAlasan] = useState('');
  const muatan = usePratinjauMuatan(
    idKendaraan ? Number(idKendaraan) : null,
    suratJalan.map((s) => s.id),
  ).data;
  const ditolak = muatan?.kesimpulan === 'DITOLAK';
  const perluAlasan = muatan?.kesimpulan === 'KONFIRMASI';
  const memuat = kendaraan.isLoading || sopir.isLoading;
  const kosong =
    !memuat && ((kendaraan.data ?? []).length === 0 || (sopir.data ?? []).length === 0);

  function kirim() {
    if (!idKendaraan || !idSopir) {
      toast.error(!idKendaraan ? 'Pilih kendaraan.' : 'Pilih sopir.');
      return;
    }
    if (ditolak) {
      toast.error(
        'Muatan melebihi batas kendaraan ini. Kurangi surat jalan atau pilih kendaraan lain.',
      );
      return;
    }
    if (perluAlasan && alasan.trim().length < 10) {
      toast.error('Tulis alasan kenapa muatan tetap aman (minimal 10 huruf).');
      document.getElementById('alasan-muatan')?.focus();
      return;
    }
    berangkat
      .mutateAsync({
        idKendaraan: Number(idKendaraan),
        idSopir: Number(idSopir),
        idSuratJalan: suratJalan.map((s) => s.id),
        catatan: catatan.trim() || null,
        alasanMuatan: perluAlasan ? alasan.trim() : null,
      })
      .then((p) => {
        toast.success(`${p.nomor} berangkat: ${p.plat}, sopir ${p.namaSopir}.`);
        onSelesai?.();
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent
        className="sm:max-w-lg"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            kirim();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Berangkat ({suratJalan.length} surat jalan)</DialogTitle>
          <DialogDescription>
            Pilih kendaraan dan sopir. Keduanya tercatat sedang jalan sampai hasil antar dicatat.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border bg-slate-50 p-2 text-sm">
          {suratJalan.map((s) => (
            <li key={s.id} className="truncate">
              <span className="font-mono font-medium">{s.nomor}</span> · {s.namaPelanggan ?? '—'} ·{' '}
              <span className="text-slate-500">{s.alamatKirim}</span>
            </li>
          ))}
        </ul>
        {kosong ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Belum ada {(kendaraan.data ?? []).length === 0 ? 'kendaraan' : 'sopir'} aktif. Tambah
            dulu di{' '}
            <Link to="/armada" className="font-semibold underline">
              Data Master › Kendaraan & Sopir
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1">
              <span className="font-medium">Kendaraan</span>
              <select
                autoFocus
                className={kelasPilih}
                value={idKendaraan}
                onChange={(e) => setIdKendaraan(e.target.value)}
                aria-label="Kendaraan"
              >
                <option value="">— pilih kendaraan —</option>
                {(kendaraan.data ?? []).map((k) => (
                  <option key={k.id} value={k.id} disabled={k.sedangJalan !== null}>
                    {k.plat} · {k.jenis}
                    {tandaSurat(k)}
                    {k.kapasitasKg ? ` · ${k.kapasitasKg.toLocaleString('id-ID')} kg` : ''}
                    {k.sedangJalan
                      ? ` — sedang jalan (${k.sedangJalan.nomor}, ${formatWaktu(k.sedangJalan.waktuBerangkat).slice(11)})`
                      : ''}
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
                aria-label="Sopir"
              >
                <option value="">— pilih sopir —</option>
                {(sopir.data ?? []).map((s) => (
                  <option key={s.id} value={s.id} disabled={s.sedangJalan !== null}>
                    {s.nama}
                    {s.noHp ? ` · ${s.noHp}` : ''}
                    {s.sedangJalan ? ` — sedang jalan (${s.sedangJalan.nomor})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {muatan && <PanelMuatan m={muatan} />}
            {perluAlasan && (
              <label className="grid gap-1">
                <span className="font-medium text-orange-800">
                  Alasan muatan tetap aman (wajib, tercatat)
                </span>
                <textarea
                  id="alasan-muatan"
                  rows={2}
                  maxLength={500}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Urut kejadiannya, mis. sak ditumpuk satu lapis di atas dinding bak, diikat tali, ditutup terpal; sudah dicek sopir."
                  className="rounded-md border border-orange-300 px-2 py-1 text-sm"
                  aria-label="Alasan muatan"
                />
              </label>
            )}
            <Input
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan perjalanan (opsional), mis. rute"
              aria-label="Catatan perjalanan"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button disabled={berangkat.isPending || kosong || ditolak} onClick={kirim}>
            <Truck /> {berangkat.isPending ? 'Menyimpan…' : 'Berangkat (Enter)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
