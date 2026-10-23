import {
  formatRupiah,
  LABEL_METODE_PEMBAYARAN,
  LABEL_STATUS_VERIFIKASI,
  STATUS_VERIFIKASI,
  type BarisNonTunai,
  type StatusVerifikasi,
} from '@sit/shared';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { TeksLipat } from '@/components/teks-lipat';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarNonTunai, useDaftarRekening, useVerifikasiNonTunai } from '@/api/rekening';
import { BadgeVerifikasi } from '@/components/badge-verifikasi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
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
import { Label } from '@/components/ui/label';
import { formatWaktu } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

const SEMUA = 'SEMUA';

/** Dialog untuk menandai "tidak masuk" (wajib catatan) atau mengubah hasil pengecekan yang sudah ada. */
function DialogPeriksa({
  p,
  statusAwal,
  onTutup,
}: {
  p: BarisNonTunai;
  statusAwal: StatusVerifikasi;
  onTutup: () => void;
}) {
  const verifikasi = useVerifikasiNonTunai();
  const [status, setStatus] = useState<StatusVerifikasi>(statusAwal);
  const [catatan, setCatatan] = useState(p.catatanVerifikasi ?? '');
  const wajibCatatan = status === 'TIDAK_MASUK';
  const kurang = wajibCatatan && catatan.trim().length < 3;
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hasil pengecekan {p.nomor}</DialogTitle>
          <DialogDescription>
            {LABEL_METODE_PEMBAYARAN[p.metode]} <b>{formatRupiah(p.nominal)}</b> ke{' '}
            <b>{p.rekening ?? '(tanpa rekening)'}</b> untuk {p.nomorPenjualan}
            {p.namaPembeli ? ` (${p.namaPembeli})` : ''}, dicatat {p.namaKasir} pada{' '}
            {formatWaktu(p.tanggal)}
            {p.referensi ? `, referensi ${p.referensi}` : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Hasil pengecekan">
          {STATUS_VERIFIKASI.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-md border-2 py-1.5 text-sm font-semibold',
                status === s ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200',
              )}
            >
              {LABEL_STATUS_VERIFIKASI[s]}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="catatan-cek">
            Catatan {wajibCatatan ? '(wajib: apa yang Anda temukan)' : '(opsional)'}
          </Label>
          <Input
            id="catatan-cek"
            value={catatan}
            maxLength={255}
            autoFocus
            placeholder={
              wajibCatatan
                ? 'mis. tidak ada di mutasi BCA 12/10; pembeli sudah dihubungi'
                : 'mis. masuk 12/10 pukul 14.05'
            }
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>
        {status === 'TIDAK_MASUK' && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            Menandai <b>Tidak masuk</b> tidak mengubah penjualannya: transaksi tetap tercatat lunas
            dan stok tetap keluar. Tanda ini pengingat untuk ditindaklanjuti: hubungi pembeli dan,
            setelah uangnya benar-benar masuk, ubah menjadi Sudah masuk; atau batalkan penjualannya
            lewat Void (hari yang sama) atau Retur.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button
            disabled={verifikasi.isPending || kurang}
            onClick={() =>
              void verifikasi
                .mutateAsync({ id: p.id, json: { status, catatan: catatan.trim() || null } })
                .then(() => {
                  toast.success(`${p.nomor}: ${LABEL_STATUS_VERIFIKASI[status].toLowerCase()}.`);
                  onTutup();
                })
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            Simpan hasil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Shift & Clerical Check › Cek uang non-tunai (K-111). Pasangan clerical check untuk uang yang tidak lewat
 * laci: tiap pembayaran transfer/EDC/QRIS dicocokkan dengan mutasi rekening lalu ditandai. Hanya pemegang
 * `kas.nontunai.verifikasi` (Admin/Owner).
 */
export function TabNonTunai() {
  const [url] = useSearchParams();
  const awal = url.get('status');
  const [status, setStatus] = useState<StatusVerifikasi | null>(
    (STATUS_VERIFIKASI as readonly string[]).includes(awal ?? '')
      ? (awal as StatusVerifikasi)
      : 'BELUM_DICEK',
  );
  const [idRekening, setIdRekening] = useState<number | null>(null);
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [periksa, setPeriksa] = useState<{ p: BarisNonTunai; status: StatusVerifikasi } | null>(
    null,
  );
  const perHalaman = useBarisPerHalaman();
  const rekening = useDaftarRekening('SEMUA').data ?? [];
  const daftar = useDaftarNonTunai({
    status,
    idRekening,
    dari,
    sampai,
    cari: useTunda(cari, 300),
    halaman,
    perHalaman,
  });
  const verifikasi = useVerifikasiNonTunai();
  const ubahSaring = (f: () => void) => {
    f();
    setHalaman(1);
  };

  const kolom: KolomTabel<BarisNonTunai>[] = [
    {
      kunci: 'waktu',
      judul: 'Dicatat',
      sel: (p) => (
        <div className="leading-tight whitespace-nowrap">
          <div>{formatWaktu(p.tanggal)}</div>
          <div className="font-mono text-xs text-slate-500">{p.nomor}</div>
        </div>
      ),
    },
    {
      kunci: 'transaksi',
      judul: 'Transaksi',
      sel: (p) => (
        <div className="leading-tight">
          <Link
            to={`/penjualan/${p.idPenjualan}`}
            className="font-mono text-xs font-medium text-blue-700 hover:underline"
          >
            {p.nomorPenjualan}
          </Link>
          <div className="text-xs text-slate-500">
            {p.namaPembeli ?? 'Pembeli umum'} · kasir {p.namaKasir}
          </div>
        </div>
      ),
    },
    {
      kunci: 'tujuan',
      judul: 'Masuk ke',
      sel: (p) => (
        <div className="leading-tight">
          <div>
            <b>{LABEL_METODE_PEMBAYARAN[p.metode]}</b> · {p.rekening ?? '(tanpa rekening)'}
          </div>
          <div className="text-xs text-slate-500">
            {p.referensi ? `referensi ${p.referensi}` : 'tanpa nomor referensi'}
          </div>
        </div>
      ),
    },
    {
      kunci: 'nominal',
      judul: 'Nominal',
      className: 'text-right',
      sel: (p) => <span className="font-semibold tabular-nums">{formatRupiah(p.nominal)}</span>,
    },
    {
      kunci: 'status',
      judul: 'Hasil cek',
      sel: (p) => (
        <div className="leading-tight">
          <BadgeVerifikasi status={p.statusVerifikasi} catatan={p.catatanVerifikasi} />
          {p.namaPemeriksa && p.diverifikasiPada && (
            <div className="text-xs text-slate-500">
              {p.namaPemeriksa}, {formatWaktu(p.diverifikasiPada)}
            </div>
          )}
          {p.catatanVerifikasi && (
            <TeksLipat teks={p.catatanVerifikasi} className="max-w-64 text-xs text-slate-500" />
          )}
        </div>
      ),
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'text-right',
      sel: (p) =>
        p.statusVerifikasi === 'BELUM_DICEK' ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              disabled={verifikasi.isPending}
              aria-label={`Sudah masuk: ${p.nomor}`}
              onClick={() =>
                void verifikasi
                  .mutateAsync({ id: p.id, json: { status: 'SUDAH_MASUK', catatan: null } })
                  .then(() => toast.success(`${p.nomor}: sudah masuk.`))
                  .catch((err: unknown) => toast.error(pesanGalat(err)))
              }
            >
              <Check /> Sudah masuk
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Tidak masuk: ${p.nomor}`}
              onClick={() => setPeriksa({ p, status: 'TIDAK_MASUK' })}
            >
              <X /> Tidak masuk…
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            aria-label={`Ubah hasil cek ${p.nomor}`}
            onClick={() => setPeriksa({ p, status: p.statusVerifikasi })}
          >
            Ubah…
          </Button>
        ),
    },
  ];

  const ringkasan = daftar.data?.ringkasan ?? [];
  const total = ringkasan.reduce((t, r) => t + r.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-80 text-sm text-slate-600">
          Pembayaran transfer, EDC, dan QRIS yang dicatat kasir. Cocokkan tiap baris dengan mutasi
          rekening, lalu tandai <b>Sudah masuk</b> atau <b>Tidak masuk</b>.
        </p>
        <Penjelasan judul="Cara mengecek uang non-tunai">
          <ButirPenjelasan>
            <li>
              <b>Kenapa perlu dicek.</b> Saat pembeli membayar lewat transfer, EDC, atau QRIS, kasir
              hanya melihat bukti di HP pembeli atau struk mesin. Uangnya baru pasti setelah tampil
              di rekening penerimaan toko. Sistem tidak tersambung ke bank, jadi kepastian itu
              dicatat di sini oleh Admin/Owner.
            </li>
            <li>
              <b>Langkah harian.</b> (1) Buka m-banking atau internet banking rekening penerimaan
              toko, lihat mutasi hari itu. Untuk EDC lihat rekap <i>settlement</i> mesin; untuk QRIS
              lihat riwayat transaksi di aplikasi merchant. (2) Di halaman ini biarkan saringan{' '}
              <i>Belum dicek</i>. (3) Untuk tiap baris, cari uang masuk dengan nominal dan waktu
              yang sama. Ada: tekan <b>Sudah masuk</b>. Tidak ada: tekan <b>Tidak masuk…</b> dan
              tulis apa yang ditemukan.
            </li>
            <li>
              <b>Kotak ringkasan per rekening</b> menjumlahkan baris yang sedang tampil. Bandingkan
              dengan jumlah uang masuk di mutasi rekening yang sama untuk tanggal yang sama; bila
              sama, semua baris boleh ditandai Sudah masuk.
            </li>
            <li>
              <b>Tidak masuk</b> tidak mengubah penjualannya. Itu tanda untuk ditindaklanjuti:
              hubungi pembeli; setelah uangnya masuk ubah menjadi Sudah masuk; bila batal, koreksi
              penjualannya lewat Void (hari yang sama) atau Retur. Baris seperti ini tetap muncul di
              lonceng notifikasi sampai diselesaikan.
            </li>
            <li>
              <b>Salah tanda?</b> Tekan <b>Ubah…</b> pada barisnya. Setiap perubahan tercatat di log
              aktivitas beserta siapa yang mengubah.
            </li>
            <li>
              Pembayaran non-tunai yang dicatat sebelum fitur ini ada ditandai otomatis sebagai
              Sudah masuk dengan catatan khusus.
            </li>
          </ButirPenjelasan>
        </Penjelasan>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-end gap-3 border-b p-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="saring-status-cek">Hasil cek</Label>
            <select
              id="saring-status-cek"
              value={status ?? SEMUA}
              onChange={(e) =>
                ubahSaring(() =>
                  setStatus(e.target.value === SEMUA ? null : (e.target.value as StatusVerifikasi)),
                )
              }
              className="h-9 rounded-md border bg-white px-2"
            >
              {STATUS_VERIFIKASI.map((s) => (
                <option key={s} value={s}>
                  {LABEL_STATUS_VERIFIKASI[s]}
                </option>
              ))}
              <option value={SEMUA}>Semua</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="saring-rekening-cek">Rekening</Label>
            <select
              id="saring-rekening-cek"
              value={idRekening ?? ''}
              onChange={(e) =>
                ubahSaring(() => setIdRekening(e.target.value ? Number(e.target.value) : null))
              }
              className="h-9 max-w-64 rounded-md border bg-white px-2"
            >
              <option value="">Semua rekening</option>
              {rekening.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nama}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="saring-dari-cek">Dari tanggal</Label>
            <Input
              id="saring-dari-cek"
              type="date"
              value={dari}
              onChange={(e) => ubahSaring(() => setDari(e.target.value))}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="saring-sampai-cek">Sampai tanggal</Label>
            <Input
              id="saring-sampai-cek"
              type="date"
              value={sampai}
              onChange={(e) => ubahSaring(() => setSampai(e.target.value))}
              className="w-40"
            />
          </div>
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="saring-cari-cek">Cari</Label>
            <Input
              id="saring-cari-cek"
              value={cari}
              placeholder="Nomor transaksi, pembeli, atau referensi…"
              onChange={(e) => ubahSaring(() => setCari(e.target.value))}
            />
          </div>
        </div>
        {ringkasan.length > 0 && (
          <div
            className="flex flex-wrap gap-2 border-b bg-slate-50 p-3 text-sm"
            data-testid="ringkasan-nontunai"
          >
            {ringkasan.map((r) => (
              <div key={r.rekening} className="rounded-md border bg-white px-3 py-1.5">
                <div className="text-xs text-slate-500">{r.rekening}</div>
                <div className="font-semibold tabular-nums">
                  {formatRupiah(r.total)}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    · {r.jumlah} pembayaran
                  </span>
                </div>
              </div>
            ))}
            {ringkasan.length > 1 && (
              <div className="rounded-md border border-slate-300 bg-white px-3 py-1.5">
                <div className="text-xs text-slate-500">Semua rekening</div>
                <div className="font-semibold tabular-nums">{formatRupiah(total)}</div>
              </div>
            )}
          </div>
        )}
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(p) => p.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong={
            status === 'BELUM_DICEK'
              ? 'Tidak ada pembayaran non-tunai yang menunggu dicek.'
              : 'Tidak ada pembayaran non-tunai yang cocok.'
          }
        />
      </Card>
      {periksa && (
        <DialogPeriksa p={periksa.p} statusAwal={periksa.status} onTutup={() => setPeriksa(null)} />
      )}
    </div>
  );
}
