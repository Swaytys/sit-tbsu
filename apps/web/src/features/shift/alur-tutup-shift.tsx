import { formatRupiah, type DetailShift } from '@sit/shared';
import { CircleAlert, Lock, OctagonX, RotateCcw, Send } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useHalMenggantung, useHasilHitung, useHitungTutup, useTutupShift } from '@/api/penjualan';
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
  akui = false,
  terhalang = false,
}: {
  idShift: number;
  ulang: boolean;
  onTerkirim?: () => void;
  /** K-197: daftar "Sebelum menutup" sudah dicentang. */
  akui?: boolean;
  /** K-197: ada penghalang (BLOK) atau daftar belum dicentang. */
  terhalang?: boolean;
}) {
  const kirim = useHitungTutup();
  const [n, setN] = useState<NilaiHitung>(HITUNG_KOSONG);
  const [yakin, setYakin] = useState(false);
  const total = totalHitung(n);
  function lanjut() {
    kirim
      .mutateAsync({ id: idShift, json: keJsonHitung(n, akui) })
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
        <Button type="submit" className="w-full" disabled={total === null || terhalang}>
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
  if (status === 'BUKA') return <TutupBuka idShift={idShift} />;
  return <HasilTutup idShift={idShift} onSelesai={onSelesai} />;
}

/** Langkah 1 tutup shift dengan daftar "Sebelum menutup" (K-197). */
function TutupBuka({ idShift }: { idShift: number }) {
  const menggantung = useHalMenggantung(idShift);
  const [akui, setAkui] = useState(false);
  const daftar = menggantung.data ?? [];
  const blok = daftar.filter((h) => h.tingkat === 'BLOK');
  const info = daftar.filter((h) => h.tingkat === 'INFO');
  return (
    <div className="space-y-2">
      <DaftarOrderBelumSelesai />
      {daftar.length > 0 && (
        <div className="space-y-2 rounded-lg border p-3 text-sm" data-testid="sebelum-menutup">
          <p className="font-semibold text-slate-800">Sebelum menutup</p>
          {[...blok, ...info].map((h) => (
            <div
              key={h.kode}
              className={cn(
                'rounded-md border p-2',
                h.tingkat === 'BLOK'
                  ? 'border-red-300 bg-red-50 text-red-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900',
              )}
            >
              <div className="flex items-start gap-1.5 font-semibold">
                {h.tingkat === 'BLOK' ? (
                  <OctagonX className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                )}
                <span className="flex-1">
                  {h.judul} ({h.jumlah})
                </span>
                {h.tautan && (
                  <Link to={h.tautan} className="text-xs font-medium underline">
                    Buka
                  </Link>
                )}
              </div>
              <p className="text-xs">{h.keterangan}</p>
              <ul className="mt-1 space-y-0.5 text-xs opacity-90">
                {h.rincian.slice(0, 5).map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {h.rincian.length > 5 && <li>… dan {h.rincian.length - 5} lagi</li>}
              </ul>
            </div>
          ))}
          {blok.length > 0 ? (
            <p className="text-xs font-semibold text-red-800">
              Selesaikan yang merah dulu; setelah itu shift bisa dihitung.
            </p>
          ) : (
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={akui}
                onChange={(e) => setAkui(e.target.checked)}
                aria-label="Sudah saya periksa"
              />
              Sudah saya periksa; yang kuning dilanjutkan di shift berikutnya.
            </label>
          )}
        </div>
      )}
      <p className="text-sm text-slate-600">
        Hitung <b>semua</b> uang shift. Angka sistem tampil setelah dikirim.
      </p>
      <FormHitung
        idShift={idShift}
        ulang={false}
        akui={akui}
        terhalang={blok.length > 0 || (info.length > 0 && !akui)}
      />
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
        json: { keterangan: ket.trim() || null, uangDitinggal: tinggal, akuiMenggantung: false },
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
