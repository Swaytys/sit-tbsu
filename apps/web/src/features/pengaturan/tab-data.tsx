import {
  LABEL_JENIS_DATA,
  LABEL_PERAN,
  SIMPAN_PENGAMAN,
  skemaEksporData,
  type ManifestData,
  type Peran,
  type RingkasData,
} from '@sit/shared';
import {
  Archive,
  Database,
  Download,
  Eye,
  GraduationCap,
  HardDriveDownload,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  useAmbilHarian,
  useBuatDataBaru,
  useBuatDataLatihan,
  useEksporData,
  useHapusData,
  useImporData,
  usePakaiData,
  useSalinanData,
  useSnapshotHarian,
  useStatusData,
} from '@/api/data';
import { pesanGalat } from '@/api/client';
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
import { Skeleton } from '@/components/ui/skeleton';
import { formatTanggal, formatWaktu, ukuranTeks } from '@/lib/format';

/*
 * K-213/K-218/K-219: Pengaturan › Data toko & pindah komputer (Owner). Data yang sedang dipakai + data toko lain
 * yang tersimpan di komputer ini: lihat rincian, pakai (data sekarang disimpan dulu otomatis), hapus, berkas pindah
 * komputer (.bonsai), masukkan berkas, ambil dari cadangan harian, buat data toko baru yang kosong.
 */

function rentang(r: RingkasData): string {
  if (!r.transaksiPertama) return 'Belum ada penjualan';
  return `${formatTanggal(r.transaksiPertama.slice(0, 10))} – ${formatTanggal((r.transaksiTerakhir ?? r.transaksiPertama).slice(0, 10))}`;
}

function RingkasIsi({ r }: { r: RingkasData }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
      <Isi label="Toko" isi={r.namaToko || '—'} />
      <Isi label="Transaksi" isi={rentang(r)} />
      <Isi label="Penjualan" isi={`${r.jumlah.penjualan}`} />
      <Isi
        label="Barang / pelanggan / pemasok"
        isi={`${r.jumlah.barang} / ${r.jumlah.pelanggan} / ${r.jumlah.pemasok}`}
      />
      <div className="col-span-full">
        <dt className="text-xs text-slate-500">Pengguna</dt>
        <dd className="text-slate-800">{daftarPengguna(r)}</dd>
      </div>
    </dl>
  );
}

/** Akun aktif (maks. 8) + jumlah sisanya; akun nonaktif cukup dihitung. */
function daftarPengguna(r: RingkasData): string {
  if (r.pengguna.length === 0) return 'Belum ada';
  const aktif = r.pengguna.filter((p) => p.aktif);
  const tampil = aktif
    .slice(0, 8)
    .map((p) => `${p.username} (${LABEL_PERAN[p.peran as Peran] ?? p.peran})`)
    .join(', ');
  const sisa = aktif.length > 8 ? `, +${aktif.length - 8} lainnya` : '';
  const nonaktif = r.pengguna.length - aktif.length;
  return `${tampil || 'tidak ada akun aktif'}${sisa}${nonaktif > 0 ? ` · ${nonaktif} akun nonaktif` : ''}`;
}

function Isi({ label, isi }: { label: string; isi: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{isi}</dd>
    </div>
  );
}

type Aksi =
  | { jenis: 'pakai' | 'hapus' | 'rincian'; data: ManifestData }
  | { jenis: 'ekspor'; data: ManifestData | null }
  | { jenis: 'impor' | 'salinan' | 'harian' | 'baru' | 'latihan' };

export function TabData() {
  const status = useStatusData();
  const [aksi, setAksi] = useState<Aksi | null>(null);
  const s = status.data;
  if (status.isPending) return <Skeleton className="h-60 w-full" />;
  if (!s) return <p className="text-sm text-red-600">{pesanGalat(status.error)}</p>;

  return (
    <div className="space-y-4">
      <Card className="gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="size-5 text-blue-600" />
          <h2 className="flex-1 font-semibold text-slate-800">Data toko yang sedang dipakai</h2>
          <span className="text-xs text-slate-500">{ukuranTeks(s.aktif.ukuranByte)}</span>
        </div>
        <RingkasIsi r={s.aktif} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setAksi({ jenis: 'salinan' })}>
            <Save /> Simpan salinan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAksi({ jenis: 'ekspor', data: null })}
          >
            <Download /> Buat berkas pindah komputer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAksi({ jenis: 'baru' })}>
            <Plus /> Buat data toko baru
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAksi({ jenis: 'latihan' })}>
            <GraduationCap /> Buat data latihan
          </Button>
        </div>
      </Card>

      <Card className="gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Archive className="size-5 text-blue-600" />
          <h2 className="flex-1 font-semibold text-slate-800">Data toko lain di komputer ini</h2>
          <span className="text-xs text-slate-500">
            Total di disk: {ukuranTeks(s.totalUkuranByte)}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Data toko yang pernah dipakai atau disimpan di komputer ini: salinan yang Anda simpan,
          data sebelum membuat data toko baru, berkas dari komputer lain, atau dari cadangan harian.{' '}
          <b>Pakai data ini</b> mengganti data yang sedang dipakai; data yang sedang dipakai
          disimpan dulu secara otomatis sehingga bisa dipakai kembali.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAksi({ jenis: 'impor' })}>
            <Upload /> Masukkan berkas pindah komputer
          </Button>
          {s.cadanganHarianSiap && (
            <Button size="sm" variant="outline" onClick={() => setAksi({ jenis: 'harian' })}>
              <HardDriveDownload /> Ambil dari cadangan harian
            </Button>
          )}
        </div>
        <DaftarData
          daftar={s.pustaka}
          kosong="Belum ada data toko lain."
          onAksi={setAksi}
          bolehHapus
        />
      </Card>

      <Card className="gap-3 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600" />
          <h2 className="font-semibold text-slate-800">Simpanan otomatis sebelum ganti data</h2>
        </div>
        <p className="text-sm text-slate-600">
          Setiap kali data toko diganti, data sebelumnya disimpan sendiri di sini agar bisa dipakai
          kembali bila salah pilih. Hanya {SIMPAN_PENGAMAN} terbaru yang disimpan agar komputer
          tidak penuh. Cadangan harian tetap tersimpan terpisah (Pengaturan › Cadangan).
        </p>
        <DaftarData daftar={s.pengaman} kosong="Belum ada." onAksi={setAksi} bolehHapus={false} />
      </Card>

      {aksi && <DialogAksi aksi={aksi} onTutup={() => setAksi(null)} />}
    </div>
  );
}

function DaftarData({
  daftar,
  kosong,
  onAksi,
  bolehHapus,
}: {
  daftar: ManifestData[];
  kosong: string;
  onAksi: (a: Aksi) => void;
  bolehHapus: boolean;
}) {
  if (daftar.length === 0) return <p className="text-sm text-slate-500">{kosong}</p>;
  return (
    <ul className="divide-y rounded-md border">
      {daftar.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
              {d.namaToko || 'Tanpa nama toko'}
              <Badge variant="outline">{LABEL_JENIS_DATA[d.jenis]}</Badge>
            </p>
            <p className="text-xs text-slate-500">
              {d.label} · disimpan {formatWaktu(d.dibuatPada)} · {rentang(d)} · {d.pengguna.length}{' '}
              pengguna · {ukuranTeks(d.ukuranByte)}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onAksi({ jenis: 'rincian', data: d })}>
            <Eye /> Rincian
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAksi({ jenis: 'ekspor', data: d })}>
            <Download /> Ekspor
          </Button>
          <Button size="sm" onClick={() => onAksi({ jenis: 'pakai', data: d })}>
            <RotateCcw /> Pakai data ini
          </Button>
          {bolehHapus && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Hapus ${d.label}`}
              title="Hapus data ini dari komputer"
              onClick={() => onAksi({ jenis: 'hapus', data: d })}
            >
              <Trash2 className="text-red-600" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function DialogAksi({ aksi, onTutup }: { aksi: Aksi; onTutup: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onTutup()}>
      <DialogContent className="max-w-xl">
        {aksi.jenis === 'rincian' && <Rincian data={aksi.data} />}
        {aksi.jenis === 'pakai' && <Pakai data={aksi.data} onTutup={onTutup} />}
        {aksi.jenis === 'hapus' && <Hapus data={aksi.data} onTutup={onTutup} />}
        {aksi.jenis === 'ekspor' && <Ekspor data={aksi.data} onTutup={onTutup} />}
        {aksi.jenis === 'impor' && <Impor onTutup={onTutup} />}
        {aksi.jenis === 'salinan' && <Salinan onTutup={onTutup} />}
        {aksi.jenis === 'harian' && <Harian onTutup={onTutup} />}
        {aksi.jenis === 'baru' && <BuatBaru onTutup={onTutup} />}
        {aksi.jenis === 'latihan' && <BuatLatihan onTutup={onTutup} />}
      </DialogContent>
    </Dialog>
  );
}

function Rincian({ data }: { data: ManifestData }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{data.namaToko || 'Tanpa nama toko'}</DialogTitle>
        <DialogDescription>
          {LABEL_JENIS_DATA[data.jenis]} · {data.label}
        </DialogDescription>
      </DialogHeader>
      <RingkasIsi r={data} />
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Isi label="Disimpan" isi={formatWaktu(data.dibuatPada)} />
        <Isi label="Ukuran" isi={ukuranTeks(data.ukuranByte)} />
        <Isi label="Versi aplikasi saat disimpan" isi={data.versiAplikasi} />
        <Isi label="Struktur database" isi={`${data.migrasi} migrasi`} />
      </dl>
    </>
  );
}

function KolomPassword({ nilai, ubah }: { nilai: string; ubah: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">Password Anda (konfirmasi)</span>
      <Input
        type="password"
        autoComplete="current-password"
        autoFocus
        value={nilai}
        onChange={(e) => ubah(e.target.value)}
      />
    </label>
  );
}

function Pakai({ data, onTutup }: { data: ManifestData; onTutup: () => void }) {
  const pakai = usePakaiData();
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        pakai
          .mutateAsync({ id: data.id, password })
          .then(() => {
            toast.success('Data diganti. Masuk lagi dengan akun dari data ini.');
            setTimeout(() => window.location.assign('/login'), 1200);
          })
          .catch((err: unknown) => toast.error(pesanGalat(err)));
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Pakai data “{data.namaToko || data.label}”?</DialogTitle>
        <DialogDescription>
          Data toko yang sedang dipakai akan diganti dengan data ini.
        </DialogDescription>
      </DialogHeader>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>Data yang sedang dipakai disimpan dulu secara otomatis (bisa dipakai kembali).</li>
        <li>
          Semua pengguna keluar; masuk lagi dengan akun yang ada di data ini (
          {data.pengguna.map((p) => p.username).join(', ') || 'tidak ada akun'}).
        </li>
        <li>
          Perangkat lain yang sedang membuka aplikasi juga harus masuk lagi. Jangan ada transaksi
          berjalan.
        </li>
        <li>Lama proses: beberapa detik sampai beberapa menit, tergantung besar data.</li>
      </ul>
      <KolomPassword nilai={password} ubah={setPassword} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onTutup} disabled={pakai.isPending}>
          Batal
        </Button>
        <Button type="submit" disabled={!password || pakai.isPending}>
          {pakai.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Pakai data ini
        </Button>
      </DialogFooter>
    </form>
  );
}

function Hapus({ data, onTutup }: { data: ManifestData; onTutup: () => void }) {
  const hapus = useHapusData();
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        hapus
          .mutateAsync({ id: data.id, password })
          .then(() => {
            toast.success('Data dihapus.');
            onTutup();
          })
          .catch((err: unknown) => toast.error(pesanGalat(err)));
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Hapus “{data.label}”?</DialogTitle>
        <DialogDescription>
          Data ini ({data.namaToko || 'tanpa nama toko'}, {ukuranTeks(data.ukuranByte)}) dihapus
          permanen dari komputer ini. Data yang sedang dipakai dan cadangan harian tidak
          terpengaruh.
        </DialogDescription>
      </DialogHeader>
      <KolomPassword nilai={password} ubah={setPassword} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onTutup}>
          Batal
        </Button>
        <Button type="submit" variant="destructive" disabled={!password || hapus.isPending}>
          <Trash2 /> Hapus permanen
        </Button>
      </DialogFooter>
    </form>
  );
}

function Ekspor({ data, onTutup }: { data: ManifestData | null; onTutup: () => void }) {
  const ekspor = useEksporData();
  const [isi, setIsi] = useState({ sandi: '', sandiUlang: '', password: '' });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = skemaEksporData.safeParse({ ...isi, id: data?.id });
        if (!v.success) {
          toast.error(v.error.issues[0]?.message ?? 'Isian belum lengkap.');
          return;
        }
        ekspor
          .mutateAsync(v.data)
          .then((nama) => {
            toast.success(`Berkas ${nama} diunduh. Simpan berkas dan sandinya.`);
            onTutup();
          })
          .catch((err: unknown) => toast.error(pesanGalat(err)));
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>
          Berkas pindah komputer: {data ? `“${data.label}”` : 'data yang sedang dipakai'}
        </DialogTitle>
        <DialogDescription>
          Satu berkas <b>.bonsai</b> berisi seluruh data (database, gambar) terenkripsi dengan
          sandi. Dipakai untuk pindah ke komputer lain: di komputer baru, pada setup awal pilih{' '}
          <i>Lanjutkan data yang sudah ada</i>, atau Pengaturan › Data toko › Masukkan berkas.
        </DialogDescription>
      </DialogHeader>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Sandi berkas (minimal 8 karakter)</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={isi.sandi}
          onChange={(e) => setIsi({ ...isi, sandi: e.target.value })}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Ulangi sandi berkas</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={isi.sandiUlang}
          onChange={(e) => setIsi({ ...isi, sandiUlang: e.target.value })}
        />
      </label>
      <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
        Catat sandi ini. Tanpa sandi, berkas tidak bisa dibuka oleh siapa pun.
      </p>
      <KolomPassword nilai={isi.password} ubah={(v) => setIsi({ ...isi, password: v })} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onTutup}>
          Batal
        </Button>
        <Button type="submit" disabled={ekspor.isPending}>
          {ekspor.isPending ? <Loader2 className="animate-spin" /> : <Download />} Buat berkas
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FormImpor({
  sibuk,
  onKirim,
  labelTombol,
}: {
  sibuk: boolean;
  onKirim: (berkas: File, sandi: string) => void;
  labelTombol: string;
}) {
  const [berkas, setBerkas] = useState<File | null>(null);
  const [sandi, setSandi] = useState('');
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (berkas && sandi) onKirim(berkas, sandi);
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Berkas data (.bonsai)</span>
        <Input
          type="file"
          accept=".bonsai"
          onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Sandi berkas</span>
        <Input
          type="password"
          autoComplete="off"
          value={sandi}
          onChange={(e) => setSandi(e.target.value)}
        />
      </label>
      <Button type="submit" disabled={!berkas || !sandi || sibuk}>
        {sibuk ? <Loader2 className="animate-spin" /> : <Upload />} {labelTombol}
      </Button>
    </form>
  );
}

function Impor({ onTutup }: { onTutup: () => void }) {
  const impor = useImporData();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Masukkan berkas pindah komputer</DialogTitle>
        <DialogDescription>
          Berkas .bonsai dari komputer lain disimpan ke daftar data toko di komputer ini. Data yang
          sedang dipakai tidak berubah sampai Anda memilih <b>Pakai data ini</b>.
        </DialogDescription>
      </DialogHeader>
      <FormImpor
        sibuk={impor.isPending}
        labelTombol="Masukkan berkas"
        onKirim={(berkas, sandi) =>
          void impor
            .mutateAsync({ berkas, sandi })
            .then((m) => {
              toast.success(`Data ${m.namaToko || m.label} tersimpan di komputer ini.`);
              onTutup();
            })
            .catch((err: unknown) => toast.error(pesanGalat(err)))
        }
      />
    </>
  );
}

function Salinan({ onTutup }: { onTutup: () => void }) {
  const salinan = useSalinanData();
  const [label, setLabel] = useState(`Salinan ${new Date().toLocaleDateString('id-ID')}`);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        salinan
          .mutateAsync(label)
          .then(() => {
            toast.success('Salinan data toko disimpan.');
            onTutup();
          })
          .catch((err: unknown) => toast.error(pesanGalat(err)));
      }}
    >
      <DialogHeader>
        <DialogTitle>Simpan salinan data toko</DialogTitle>
        <DialogDescription>
          Mis. sebelum mencoba sesuatu yang besar (impor barang massal, uji coba). Salinan bisa
          dipakai kembali kapan saja.
        </DialogDescription>
      </DialogHeader>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Nama salinan</span>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onTutup}>
          Batal
        </Button>
        <Button type="submit" disabled={salinan.isPending}>
          {salinan.isPending ? <Loader2 className="animate-spin" /> : <Save />} Simpan salinan
        </Button>
      </DialogFooter>
    </form>
  );
}

function Harian({ onTutup }: { onTutup: () => void }) {
  const daftar = useSnapshotHarian(true);
  const ambil = useAmbilHarian();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Ambil dari cadangan harian</DialogTitle>
        <DialogDescription>
          Pilih tanggal cadangan. Isinya disalin ke daftar data toko di komputer ini; data yang
          sedang dipakai tidak berubah sampai Anda memilih <b>Pakai data ini</b>.
        </DialogDescription>
      </DialogHeader>
      {daftar.isPending ? (
        <Loader2 className="size-5 animate-spin text-slate-400" />
      ) : daftar.isError ? (
        <p className="text-sm text-red-600">{pesanGalat(daftar.error)}</p>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {(daftar.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <History className="size-4 text-slate-400" />
              <span className="flex-1">{formatWaktu(s.waktu)}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={ambil.isPending}
                onClick={() =>
                  void ambil
                    .mutateAsync(s.id)
                    .then(() => {
                      toast.success('Cadangan disalin ke daftar data toko.');
                      onTutup();
                    })
                    .catch((err: unknown) => toast.error(pesanGalat(err)))
                }
              >
                {ambil.isPending ? <Loader2 className="animate-spin" /> : null} Salin ke daftar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** K-219: data toko baru yang kosong; data sekarang disimpan dan bisa dipakai lagi. */
function BuatBaru({ onTutup }: { onTutup: () => void }) {
  const baru = useBuatDataBaru();
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        baru
          .mutateAsync(password)
          .then(() => {
            toast.success('Data toko baru dibuat. Kerjakan setup awal.');
            setTimeout(() => window.location.assign('/'), 1200);
          })
          .catch((err: unknown) => toast.error(pesanGalat(err)));
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Buat data toko baru?</DialogTitle>
        <DialogDescription>
          Untuk mencoba dari awal atau memakai aplikasi ini untuk toko lain.
        </DialogDescription>
      </DialogHeader>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>
          Data toko yang sedang dipakai <b>tidak dihapus</b>: disimpan di daftar{' '}
          <i>Data toko lain di komputer ini</i> dan bisa dipakai kembali.
        </li>
        <li>Aplikasi kembali ke setup awal seperti baru dipasang (akun Owner dibuat ulang).</li>
        <li>Semua pengguna keluar. Tutup shift lebih dulu; perangkat lain jangan bertransaksi.</li>
      </ul>
      <KolomPassword nilai={password} ubah={setPassword} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onTutup} disabled={baru.isPending}>
          Batal
        </Button>
        <Button type="submit" disabled={!password || baru.isPending}>
          {baru.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Buat data toko baru
        </Button>
      </DialogFooter>
    </form>
  );
}

/** K-168: data latihan untuk melatih karyawan; data sekarang disimpan dan bisa dipakai lagi. */
function BuatLatihan({ onTutup }: { onTutup: () => void }) {
  const latihan = useBuatDataLatihan();
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        latihan
          .mutateAsync(password)
          .then(() => {
            toast.success('Data latihan siap. Masuk lagi dengan username dan password Anda.');
            setTimeout(() => window.location.assign('/login'), 1500);
          })
          .catch((err: unknown) => toast.error(pesanGalat(err)));
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Buat data latihan?</DialogTitle>
        <DialogDescription>
          Untuk melatih karyawan (Bab pelatihan di Buku SOP) tanpa mengganggu data toko sungguhan.
        </DialogDescription>
      </DialogHeader>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>
          Data toko yang sedang dipakai <b>tidak dihapus</b>: disimpan di daftar{' '}
          <i>Data toko lain di komputer ini</i>.
        </li>
        <li>
          Data latihan berisi toko bernama <b>LATIHAN – …</b>, akun Owner Anda (username dan
          password sama), contoh barang dengan stok 100, pelanggan, pemasok, kendaraan, dan sopir.
        </li>
        <li>
          Buat akun latihan untuk karyawan di <i>Data Pengguna</i>. Semua layar menampilkan pita{' '}
          <b>MODE LATIHAN</b>.
        </li>
        <li>
          Selesai berlatih: Pengaturan › Data toko › data asli › <b>Pakai data ini</b>. Tutup shift
          latihan lebih dulu.
        </li>
      </ul>
      <KolomPassword nilai={password} ubah={setPassword} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onTutup} disabled={latihan.isPending}>
          Batal
        </Button>
        <Button type="submit" disabled={!password || latihan.isPending}>
          {latihan.isPending ? <Loader2 className="animate-spin" /> : <GraduationCap />} Buat data
          latihan
        </Button>
      </DialogFooter>
    </form>
  );
}
