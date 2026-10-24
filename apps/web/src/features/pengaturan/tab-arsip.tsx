import { formatRupiah, type HasilPeriksaArsip, type TahunArsip } from '@sit/shared';
import { Archive, Download, FolderOpen, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useBukaTahun, useDaftarTahunArsip, usePeriksaArsip, useTutupTahun } from '@/api/arsip';
import { pesanGalat } from '@/api/client';
import { DialogKonfirmasi } from '@/components/dialog-konfirmasi';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

/*
 * K-165: Pengaturan › Arsip tahunan (Owner). Data tetap di database; tahun yang ditutup dikunci dan diekspor
 * utuh ke berkas arsip yang ikut dicadangkan.
 */

function ukuran(byte: number | null): string {
  if (byte === null) return '—';
  return byte >= 1_048_576 ? `${(byte / 1_048_576).toFixed(1)} MB` : `${Math.ceil(byte / 1024)} KB`;
}

function tampilkanPeriksa(h: HasilPeriksaArsip) {
  if (!h.berkasAda) {
    toast.error('Berkas arsip tidak ada di folder arsip. Pulihkan dari cadangan.');
  } else if (!h.checksumCocok) {
    toast.error('Berkas arsip berubah atau rusak (checksum tidak cocok).');
  } else if (h.selisih.length > 0) {
    toast.warning(
      `Berkas utuh, tetapi ${h.selisih.length} tabel berbeda dengan database: ` +
        h.selisih.map((x) => `${x.tabel} ${x.berkas}→${x.database}`).join(', '),
    );
  } else {
    toast.success('Berkas utuh dan sama dengan database.');
  }
}

function DialogBuka({ tahun, onTutup }: { tahun: number; onTutup: () => void }) {
  const buka = useBukaTahun();
  const [alasan, setAlasan] = useState('');
  function kirim() {
    if (alasan.trim().length < 10) {
      toast.error('Tulis alasan membuka kembali (min. 10 huruf).');
      return;
    }
    buka
      .mutateAsync({ tahun, alasan: alasan.trim() })
      .then(() => {
        toast.success(`Tahun ${tahun} dibuka kembali. Tutup lagi setelah koreksi selesai.`);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buka kembali tahun {tahun}</DialogTitle>
          <DialogDescription>
            Pencatatan bertanggal {tahun} diizinkan lagi. Berkas arsip lama tetap disimpan; saat
            ditutup ulang dibuat berkas baru.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="Alasan buka kembali"
          placeholder="mis. Koreksi catatan BBM Desember yang salah"
          value={alasan}
          maxLength={255}
          onChange={(e) => setAlasan(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && kirim()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button variant="destructive" disabled={buka.isPending} onClick={kirim}>
            {buka.isPending ? 'Memproses…' : 'Buka kembali'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LencanaStatus({ t }: { t: TahunArsip }) {
  if (t.status === 'DITUTUP') {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        Ditutup
      </Badge>
    );
  }
  if (t.status === 'DIBUKA') {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
        Dibuka kembali
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
      Belum ditutup
    </Badge>
  );
}

function KartuTahun({ t }: { t: TahunArsip }) {
  const tutup = useTutupTahun();
  const periksa = usePeriksaArsip();
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [buka, setBuka] = useState(false);
  const r = t.ringkasan;
  const ditutup = t.status === 'DITUTUP';
  const totalBaris = Object.values(r.tabel).reduce((a, b) => a + b, 0);
  return (
    <Card className="gap-2 p-4" data-testid={`arsip-${t.tahun}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{t.tahun}</h3>
        <LencanaStatus t={t} />
        <div className="ml-auto flex flex-wrap gap-2">
          {ditutup ? (
            <>
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/arsip/${t.tahun}/berkas`} download>
                  <Download /> Unduh berkas
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={periksa.isPending}
                onClick={() =>
                  void periksa
                    .mutateAsync(t.tahun)
                    .then(tampilkanPeriksa)
                    .catch((err: unknown) => toast.error(pesanGalat(err)))
                }
              >
                <ShieldCheck /> Periksa
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setBuka(true)}>
                <FolderOpen /> Buka kembali
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={t.penghalang.length > 0 || tutup.isPending}
              onClick={() => setKonfirmasi(true)}
            >
              <Archive /> {tutup.isPending ? 'Menutup…' : `Tutup tahun ${t.tahun}`}
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500">Penjualan</div>
          {r.penjualan.jumlah} nota · {formatRupiah(r.penjualan.totalNeto)}
        </div>
        <div>
          <div className="text-xs text-slate-500">Void · retur</div>
          {formatRupiah(r.penjualan.void)} · {formatRupiah(r.penjualan.retur)}
        </div>
        <div>
          <div className="text-xs text-slate-500">Penerimaan barang</div>
          {r.penerimaan.jumlah} · {formatRupiah(r.penerimaan.total)}
        </div>
        <div>
          <div className="text-xs text-slate-500">Piutang tahun itu belum lunas</div>
          {r.piutangTerbuka.jumlah} nota · {formatRupiah(r.piutangTerbuka.sisa)}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {totalBaris.toLocaleString('id-ID')} baris transaksi (termasuk void, retur, mutasi stok,
        log)
        {ditutup &&
          ` · berkas ${t.berkas ?? ''} (${ukuran(t.ukuran)}) · ditutup ${formatWaktu(t.ditutupPada)} oleh ${t.ditutupOleh ?? '—'}`}
        {t.status === 'DIBUKA' && ` · dibuka ${formatWaktu(t.dibukaPada)}: ${t.alasanBuka ?? ''}`}
      </p>
      {!ditutup && t.penghalang.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-md border border-amber-200 bg-amber-50 py-2 pr-2 pl-6 text-sm text-amber-900">
          {t.penghalang.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <DialogKonfirmasi
        terbuka={konfirmasi}
        onTutup={() => setKonfirmasi(false)}
        judul={`Tutup tahun ${t.tahun}?`}
        pesan={
          <>
            Semua transaksi {t.tahun} (termasuk void dan retur) disalin ke berkas arsip dan tahun
            itu dikunci: tidak bisa mencatat atau mengubah apa pun bertanggal {t.tahun}. Data tetap
            bisa dilihat di semua layar dan laporan. Owner bisa membuka kembali dengan alasan.
          </>
        }
        labelKonfirmasi="Tutup tahun"
        onKonfirmasi={async () => {
          try {
            await tutup.mutateAsync(t.tahun);
            toast.success(`Tahun ${t.tahun} ditutup; berkas arsip dibuat.`);
          } catch (err) {
            toast.error(pesanGalat(err));
            throw err;
          }
        }}
      />
      {buka && <DialogBuka tahun={t.tahun} onTutup={() => setBuka(false)} />}
    </Card>
  );
}

export function TabArsip() {
  const daftar = useDaftarTahunArsip();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-80">
          <h2 className="font-semibold text-slate-900">Arsip tahunan</h2>
          <p className="text-sm text-slate-500">
            Tutup tahun yang sudah lewat agar rapi: transaksinya dikunci dan disalin utuh ke berkas
            arsip yang ikut dicadangkan setiap malam.
          </p>
        </div>
        <Penjelasan judul="Cara kerja arsip tahunan">
          <ButirPenjelasan>
            <li>
              Data tidak dihapus atau dipindah: semua layar dan laporan tetap bisa menampilkan tahun
              lama. Database tetap cepat karena daftar memakai indeks tanggal dan halaman; jumlah
              data toko jauh di bawah batas yang membuat database lambat.
            </li>
            <li>
              <b>Tutup tahun</b> hanya untuk tahun yang sudah lewat dan tanpa dokumen setengah jalan
              (order belum selesai, shift belum ditutup, retur/void menunggu, surat jalan atau rit
              belum selesai, penyesuaian draf). Daftar penghalangnya tampil di kartu tahun.
            </li>
            <li>
              Setelah ditutup: tidak ada pencatatan atau perubahan bertanggal tahun itu. Retur atau
              pelunasan atas nota tahun lalu tetap boleh, karena dicatat dengan tanggal hari ini.
            </li>
            <li>
              <b>Berkas arsip</b> (folder penyimpanan, subfolder arsip) berisi semua transaksi tahun
              itu termasuk void, retur, mutasi stok, dan log, ditambah potret data master. Berkas
              dikunci dengan checksum; <b>Periksa</b> memastikan berkas utuh dan sama dengan
              database. Bila database rusak atau hilang, pulihkan dari cadangan; berkas arsip
              menjadi pembanding.
            </li>
            <li>
              <b>Buka kembali</b> (alasan wajib, tercatat di log) untuk koreksi; tutup lagi
              setelahnya. Berkas lama tidak dihapus.
            </li>
          </ButirPenjelasan>
        </Penjelasan>
      </div>
      {daftar.isLoading && <p className="text-sm text-slate-500">Memuat…</p>}
      {daftar.error && <p className="text-sm text-red-600">{pesanGalat(daftar.error)}</p>}
      {daftar.data?.length === 0 && <p className="text-sm text-slate-500">Belum ada transaksi.</p>}
      {daftar.data?.map((t) => (
        <KartuTahun key={t.tahun} t={t} />
      ))}
    </div>
  );
}
