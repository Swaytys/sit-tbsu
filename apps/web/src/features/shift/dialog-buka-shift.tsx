import { formatRupiah, type CaraBukaShift } from '@sit/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useBukaShift, useUsulanBukaShift } from '@/api/penjualan';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { HITUNG_KOSONG, keJsonHitung, totalHitung, type NilaiHitung } from './hitung-uang';
import { InputHitungUang } from './input-hitung-uang';

type Langkah = 'pilih' | 'hitung' | 'konfirmasi';

/**
 * Buka shift (K-121): tiga cara dalam satu dialog, selalu dengan konfirmasi sebelum benar-benar membuka.
 * Esc selalu bekerja di mana pun fokusnya: di langkah hitung/konfirmasi = kembali, di langkah pilih = tutup.
 */
export function DialogBukaShift({ onTutup }: { onTutup: () => void }) {
  const usulan = useUsulanBukaShift().data;
  const buka = useBukaShift();
  const [langkah, setLangkah] = useState<Langkah>('pilih');
  const [cara, setCara] = useState<CaraBukaShift>('SAMA_KEMARIN');
  const [hitung, setHitung] = useState<NilaiHitung>(HITUNG_KOSONG);
  const ditinggal = usulan?.uangDitinggal ?? null;
  const modal = cara === 'HITUNG' ? (totalHitung(hitung) ?? 0) : (ditinggal ?? 0);

  function pilih(c: CaraBukaShift) {
    if (c === 'SAMA_KEMARIN' && ditinggal === null) return;
    setCara(c);
    setLangkah(c === 'HITUNG' ? 'hitung' : 'konfirmasi');
  }

  // Huruf pintas di langkah pilih. Fokus awal ada di cara pertama yang tersedia, jadi Enter memilihnya.
  useEffect(() => {
    if (langkah !== 'pilih') return;
    function tombol(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      // Tombol yang sedang difokus menangani Enter sendiri (klik bawaan peramban).
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        pilih(ditinggal !== null ? 'SAMA_KEMARIN' : 'HITUNG');
      } else if (k === 'h') {
        e.preventDefault();
        pilih('HITUNG');
      } else if (k === 'n') {
        e.preventDefault();
        pilih('HITUNG_NANTI');
      }
    }
    window.addEventListener('keydown', tombol);
    return () => window.removeEventListener('keydown', tombol);
  });

  function kirim() {
    const isi = keJsonHitung(hitung);
    const json =
      cara !== 'HITUNG'
        ? { cara }
        : isi.rincian
          ? { cara, rincian: isi.rincian }
          : { cara, modalAwal: isi.uangFisik };
    buka
      .mutateAsync(json)
      .then((s) => {
        toast.success(`Shift ${s.nomor} dibuka, modal ${formatRupiah(s.modalAwal)}.`);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  const opsi: { c: CaraBukaShift; tombol: string; judul: string; ket: string; mati?: boolean }[] = [
    {
      c: 'SAMA_KEMARIN',
      tombol: 'Enter',
      judul:
        ditinggal === null
          ? 'Pakai uang kemarin (belum ada catatan)'
          : `Pakai uang kemarin: ${formatRupiah(ditinggal)}`,
      ket:
        ditinggal === null
          ? 'Belum ada shift ditutup dengan uang ditinggal. Pilih Hitung sekarang.'
          : `Ditinggal saat ${usulan?.nomorShift ?? ''} ditutup${usulan?.waktuTutup ? `, ${formatWaktu(usulan.waktuTutup)}` : ''}. Uang tidak disentuh sejak itu.`,
      mati: ditinggal === null,
    },
    {
      c: 'HITUNG',
      tombol: 'H',
      judul: 'Hitung sekarang',
      ket: 'Per pecahan atau total. Paling teliti.',
    },
    {
      c: 'HITUNG_NANTI',
      tombol: 'N',
      judul: 'Buka dulu, hitung nanti',
      ket: `Toko sudah ramai. Langsung jualan; hitung uang shift dalam ${usulan?.batasHitungMenit ?? 60} menit (uang penjualan tidak perlu dipisah).`,
    },
  ];

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent
        className="sm:max-w-lg"
        onEscapeKeyDown={(e) => {
          if (langkah !== 'pilih') {
            e.preventDefault();
            setLangkah(langkah === 'konfirmasi' && cara === 'HITUNG' ? 'hitung' : 'pilih');
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Buka shift toko</DialogTitle>
          <DialogDescription>
            {langkah === 'pilih'
              ? 'Modal awal = uang shift saat dibuka.'
              : langkah === 'hitung'
                ? 'Hitung semua uang shift.'
                : 'Periksa sekali lagi.'}
          </DialogDescription>
        </DialogHeader>

        {langkah === 'pilih' && (
          <div className="space-y-2" role="listbox" aria-label="Cara buka shift">
            {opsi.map((o) => (
              <button
                key={o.c}
                type="button"
                disabled={o.mati}
                onClick={() => pilih(o.c)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left',
                  o.mati
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:border-blue-400 hover:bg-blue-50',
                )}
              >
                <kbd className="mt-0.5 min-w-12 rounded border bg-slate-50 px-1.5 text-center font-mono text-xs">
                  {o.tombol}
                </kbd>
                <span>
                  <span className="block font-semibold text-slate-900">{o.judul}</span>
                  <span className="block text-sm text-slate-600">{o.ket}</span>
                </span>
              </button>
            ))}
            <p className="text-xs text-slate-500">
              <kbd className="font-mono">Esc</kbd> = tutup. Order tetap bisa dicatat tanpa shift.
            </p>
          </div>
        )}

        {langkah === 'hitung' && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (totalHitung(hitung) !== null) setLangkah('konfirmasi');
            }}
          >
            <InputHitungUang id="buka" nilai={hitung} onUbah={setHitung} autoFocus />
            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setLangkah('pilih')}>
                Kembali (Esc)
              </Button>
              <Button type="submit" disabled={totalHitung(hitung) === null}>
                Lanjut (Enter)
              </Button>
            </div>
          </form>
        )}

        {langkah === 'konfirmasi' && (
          <div className="space-y-3">
            <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4 text-center">
              <p className="text-sm text-blue-900">Buka shift dengan modal awal</p>
              <p className="text-3xl font-black text-blue-900 tabular-nums">
                {formatRupiah(modal)}
              </p>
              <p className="mt-1 text-sm text-blue-900">
                {cara === 'SAMA_KEMARIN' && 'uang kemarin'}
                {cara === 'HITUNG' && 'hasil hitungan'}
                {cara === 'HITUNG_NANTI' &&
                  `sementara; hitung uang shift dalam ${usulan?.batasHitungMenit ?? 60} menit`}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Salah ketik nanti: <b>Koreksi modal</b> di menu Shift.
            </p>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLangkah(cara === 'HITUNG' ? 'hitung' : 'pilih')}
              >
                Kembali (Esc)
              </Button>
              <Button type="button" autoFocus disabled={buka.isPending} onClick={kirim}>
                Ya, buka shift (Enter)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
