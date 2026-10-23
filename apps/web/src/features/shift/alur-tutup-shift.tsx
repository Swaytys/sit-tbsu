import { formatRupiah, type DetailShift } from '@sit/shared';
import { Lock, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import {
  useHasilHitung,
  useHitungTutup,
  usePengajuanMenunggu,
  useTutupShift,
} from '@/api/penjualan';
import { InputRupiah } from '@/components/input-rupiah';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { HITUNG_KOSONG, keJsonHitung, totalHitung, type NilaiHitung } from './hitung-uang';
import { DaftarOrderBelumSelesai } from '../order/pilihan-order';
import { InputHitungUang } from './input-hitung-uang';
import { TampilBantuan, TampilTinjauan } from './tinjauan-shift';

function Baris({ label, nilai, tebal }: { label: string; nilai: number; tebal?: boolean }) {
  return (
    <div className={cn('flex justify-between', tebal && 'border-t pt-1 font-bold')}>
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums">{formatRupiah(nilai)}</span>
    </div>
  );
}

/** Kirim hitungan uang laci (hitungan pertama atau hitung ulang), dengan konfirmasi. */
function FormHitung({
  idShift,
  ulang,
  onTerkirim,
}: {
  idShift: number;
  ulang: boolean;
  onTerkirim?: () => void;
}) {
  const kirim = useHitungTutup();
  const [n, setN] = useState<NilaiHitung>(HITUNG_KOSONG);
  const [yakin, setYakin] = useState(false);
  const total = totalHitung(n);
  function lanjut() {
    kirim
      .mutateAsync({ id: idShift, json: keJsonHitung(n) })
      .then(() => {
        setYakin(false);
        onTerkirim?.();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (total !== null) setYakin(true);
      }}
    >
      <InputHitungUang id={ulang ? 'tutup-ulang' : 'tutup'} nilai={n} onUbah={setN} />
      {!yakin ? (
        <Button type="submit" className="w-full" disabled={total === null}>
          <Send /> {ulang ? 'Kirim hitung ulang' : 'Kirim hitungan'}
        </Button>
      ) : (
        <div className="space-y-2 rounded-lg border-2 border-blue-300 bg-blue-50 p-3 text-sm">
          <p>
            Laci berisi <b>{formatRupiah(total ?? 0)}</b>?{' '}
            {ulang
              ? 'Hitung ulang terakhir; kedua hitungan tercatat.'
              : 'Setelah ini shift berhenti menerima uang. Hitung ulang boleh sekali bila selisih besar.'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setYakin(false)}>
              Kembali
            </Button>
            <Button type="button" autoFocus disabled={kirim.isPending} onClick={lanjut}>
              Ya, kirim
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * Tutup shift dua langkah (K-121 butir 4): (1) kirim hitungan — terkunci, angka sistem belum terlihat;
 * (2) hasil rekonsiliasi + tinjauan + bantuan selisih, hitung ulang sekali bila perlu, keterangan bila selisih di
 * luar toleransi, uang ditinggal di laci, lalu tutup.
 */
export function AlurTutupShift({
  idShift,
  status,
  onSelesai,
}: {
  idShift: number;
  status: 'BUKA' | 'DIHITUNG';
  onSelesai: (d: DetailShift) => void;
}) {
  if (status === 'BUKA') {
    return (
      <div className="space-y-2">
        <DaftarOrderBelumSelesai />
        <PengajuanMenunggu />
        <p className="text-sm text-slate-600">
          Hitung <b>semua</b> uang shift. Angka sistem tampil setelah dikirim.
        </p>
        <FormHitung idShift={idShift} ulang={false} />
      </div>
    );
  }
  return <HasilTutup idShift={idShift} onSelesai={onSelesai} />;
}

/** K-142: retur/void yang belum diputuskan; uangnya belum keluar dari laci (bukan selisih). */
function PengajuanMenunggu() {
  const data = usePengajuanMenunggu().data ?? [];
  if (data.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"
      data-testid="pengajuan-menunggu"
    >
      <p className="font-semibold text-blue-900">{data.length} retur/void menunggu persetujuan</p>
      <p className="text-xs text-blue-900">
        Uangnya belum keluar dari laci; tercatat di shift saat disetujui.
      </p>
      <ul className="mt-1 space-y-0.5 text-xs">
        {data.map((p) => (
          <li key={`${p.jenis}-${p.id}`} className="flex justify-between gap-2">
            <span>
              {p.jenis === 'RETUR' ? 'Retur' : 'Void'} {p.nomor} · {p.nomorPenjualan} ·{' '}
              {p.namaPengaju}
            </span>
            <span className="tabular-nums">{formatRupiah(p.nilai)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HasilTutup({
  idShift,
  onSelesai,
}: {
  idShift: number;
  onSelesai: (d: DetailShift) => void;
}) {
  const hasil = useHasilHitung(idShift);
  const tutup = useTutupShift();
  const [ket, setKet] = useState('');
  const [ditinggal, setDitinggal] = useState<number | null>(null);
  const [yakin, setYakin] = useState(false);
  const h = hasil.data;
  if (hasil.isLoading || !h) return <Skeleton className="h-60 w-full" />;
  const r = h.rekonsiliasi;
  const tinggal = ditinggal ?? h.usulanDitinggal;
  const bolehTutup = (!h.perluKeterangan || ket.trim().length >= 3) && tinggal <= r.uangFisik;

  function kirimTutup() {
    tutup
      .mutateAsync({
        id: idShift,
        json: { keterangan: ket.trim() || null, uangDitinggal: tinggal },
      })
      .then((d) => {
        toast.success(`Shift ${d.nomor} ditutup.`);
        onSelesai(d);
      })
      .catch((err: unknown) => {
        setYakin(false);
        toast.error(pesanGalat(err));
      });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="hasil-tutup-shift">
      <div className="space-y-3">
        <div className="space-y-1 text-sm">
          <Baris label="Modal awal" nilai={r.modalAwal - r.koreksiModal} />
          {r.koreksiModal !== 0 && <Baris label="Koreksi modal" nilai={r.koreksiModal} />}
          <Baris label="Penerimaan tunai (penjualan)" nilai={r.tunaiPenjualan} />
          <Baris label="Kas masuk lain" nilai={r.kasMasukLain} />
          <Baris label="Pengeluaran tunai (refund/kasbon/setor)" nilai={-r.kasKeluar} />
          <Baris label="Saldo menurut sistem" nilai={r.saldoSistem} tebal />
          <Baris label="Uang fisik dihitung" nilai={r.uangFisik} />
        </div>
        <div
          className={cn(
            'flex items-baseline justify-between rounded-md px-3 py-2 font-bold',
            r.selisih === 0
              ? 'bg-emerald-50 text-emerald-800'
              : r.dalamToleransi
                ? 'bg-slate-100 text-slate-800'
                : r.selisih < 0
                  ? 'bg-red-50 text-red-800'
                  : 'bg-amber-50 text-amber-800',
          )}
          data-testid="selisih-hitung"
        >
          <span>
            {r.selisih === 0
              ? 'Cocok'
              : r.dalamToleransi
                ? `Selisih receh (toleransi ${formatRupiah(r.toleransi)})`
                : r.selisih < 0
                  ? 'Kurang'
                  : 'Lebih'}
          </span>
          <span className="text-xl tabular-nums">{formatRupiah(r.selisih)}</span>
        </div>
        {h.hitungBukaTidakDilakukan && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            Shift ini dibuka dengan "hitung nanti" tetapi hitungan susulannya tidak pernah dikirim.
            Selisih semalam (bila ada) ikut masuk ke selisih ini.
          </p>
        )}
        <div className="text-xs text-slate-500">
          {h.hitungan
            .filter((x) => x.jenis === 'TUTUP' || x.jenis === 'TUTUP_ULANG')
            .map((x) => (
              <p key={x.waktu}>
                {x.jenis === 'TUTUP' ? 'Hitungan pertama' : 'Hitung ulang'}{' '}
                {formatRupiah(x.uangFisik)} · {formatWaktu(x.waktu)} · {x.namaPengguna}
              </p>
            ))}
        </div>

        <TampilBantuan b={h.bantuan} />

        {h.bolehHitungUlang && (
          <details className="rounded-lg border p-3">
            <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold">
              <RotateCcw className="size-4" /> Hitung ulang (sekali)
            </summary>
            <div className="mt-2">
              <FormHitung idShift={idShift} ulang />
            </div>
          </details>
        )}

        {h.perluKeterangan && (
          <div className="space-y-1">
            <Label htmlFor="ket-selisih" className="text-red-700">
              Keterangan selisih (wajib)
            </Label>
            <Textarea
              id="ket-selisih"
              rows={2}
              value={ket}
              maxLength={255}
              onChange={(e) => setKet(e.target.value)}
              placeholder="Tulis yang Anda temukan, mis. kembalian STR-… kelebihan Rp 20.000"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="uang-ditinggal">Uang ditinggal untuk shift berikutnya</Label>
          <InputRupiah id="uang-ditinggal" value={tinggal} onChange={setDitinggal} />
          <p className="text-xs text-slate-500">
            Sisanya <b>{formatRupiah(Math.max(0, r.uangFisik - tinggal))}</b> dianggap disetor.
            Angka ini menjadi usulan modal shift berikutnya.
            {tinggal > r.uangFisik && (
              <span className="block text-red-700">Tidak boleh lebih dari uang yang dihitung.</span>
            )}
          </p>
        </div>

        {!yakin ? (
          <Button className="w-full" disabled={!bolehTutup} onClick={() => setYakin(true)}>
            <Lock /> Tutup shift
          </Button>
        ) : (
          <div className="space-y-2 rounded-lg border-2 border-blue-300 bg-blue-50 p-3 text-sm">
            <p>
              Tutup shift dengan uang dihitung <b>{formatRupiah(r.uangFisik)}</b>, selisih{' '}
              <b>{formatRupiah(r.selisih)}</b>, ditinggal untuk shift berikutnya{' '}
              <b>{formatRupiah(tinggal)}</b>? Setelah ditutup angka tidak bisa diubah.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setYakin(false)}>
                Kembali
              </Button>
              <Button type="button" autoFocus disabled={tutup.isPending} onClick={kirimTutup}>
                Ya, tutup shift
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-white p-3">
        <p className="mb-2 font-semibold text-slate-900">Tinjauan shift</p>
        <TampilTinjauan t={h.tinjauan} />
      </div>
    </div>
  );
}
