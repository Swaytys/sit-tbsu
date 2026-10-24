import type { Perjalanan } from '@sit/shared';
import { CalendarPlus, Truck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useBerangkatRit, useDaftarKendaraan, useDaftarSopir, useRencanaRit } from '@/api/armada';
import { pesanGalat } from '@/api/client';
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
import { PanelMuatan } from '../pengantaran/panel-muatan';

const kelasPilih =
  'h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

/** Nilai awal isian jadwal: satu jam lagi, dibulatkan ke 30 menit (waktu lokal peramban = WIB di toko). */
function jadwalAwal(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const dua = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}T${dua(d.getHours())}:${dua(d.getMinutes())}`;
}

/** K-160: rencanakan rit (kendaraan, sopir, jadwal). Kendaraan yang sedang jalan boleh direncanakan untuk nanti. */
export function DialogRitBaru({ onTutup }: { onTutup: () => void }) {
  const kendaraan = useDaftarKendaraan('AKTIF');
  const sopir = useDaftarSopir('AKTIF');
  const rencana = useRencanaRit();
  const [idKendaraan, setIdKendaraan] = useState('');
  const [idSopir, setIdSopir] = useState('');
  const [jadwal, setJadwal] = useState(jadwalAwal);
  const [catatan, setCatatan] = useState('');

  function kirim() {
    if (!idKendaraan || !idSopir || !jadwal) {
      toast.error(
        !idKendaraan ? 'Pilih kendaraan.' : !idSopir ? 'Pilih sopir.' : 'Isi jadwal berangkat.',
      );
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
        toast.success(`Rit ${r.nomor} direncanakan. Seret order kirim ke grupnya.`);
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
          <DialogTitle>Rit baru</DialogTitle>
          <DialogDescription>
            Satu rit = satu kendaraan + satu sopir berangkat sekali. Isi dengan order kirim setelah
            dibuat.
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
          <Input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan (opsional), mis. rute Peterongan–Jombang kota"
            aria-label="Catatan rit"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button disabled={rencana.isPending} onClick={kirim}>
            <CalendarPlus /> {rencana.isPending ? 'Menyimpan…' : 'Buat rit (Enter)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** K-160/K-161: berangkatkan rit rencana; muatan dicek ulang (alasan bila perlu, ditolak bila melebihi). */
export function DialogBerangkatRit({ rit, onTutup }: { rit: Perjalanan; onTutup: () => void }) {
  const berangkat = useBerangkatRit();
  const [alasan, setAlasan] = useState('');
  const m = rit.muatan;
  const ditolak = m?.kesimpulan === 'DITOLAK';
  const perluAlasan = m?.kesimpulan === 'KONFIRMASI';

  function kirim() {
    if (perluAlasan && alasan.trim().length < 10) {
      toast.error('Tulis alasan kenapa muatan tetap aman (minimal 10 huruf).');
      return;
    }
    berangkat
      .mutateAsync({ id: rit.id, alasanMuatan: perluAlasan ? alasan.trim() : null })
      .then((r) => {
        toast.success(`${r.nomor} berangkat: ${r.plat}, sopir ${r.namaSopir}.`);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Berangkatkan {rit.nomor}</DialogTitle>
          <DialogDescription>
            {rit.plat} · sopir {rit.namaSopir} · {rit.suratJalan.length} surat jalan. Semua surat
            jalan menjadi <b>Di jalan</b>; kendaraan dan sopir terkunci sampai hasilnya dicatat.
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
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button
            disabled={berangkat.isPending || ditolak}
            onClick={kirim}
            autoFocus={!perluAlasan}
          >
            <Truck /> {berangkat.isPending ? 'Menyimpan…' : 'Berangkat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
