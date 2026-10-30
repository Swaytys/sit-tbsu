import type { BarisCadangan, StatusTujuanCadangan } from '@sit/shared';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CloudUpload,
  DatabaseBackup,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useJalankanCadangan, useStatusCadangan } from '@/api/pengaturan';
import { Badge } from '@/components/ui/badge';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWaktu } from '@/lib/format';
import { FormAturCadangan } from './form-atur-cadangan';
import { cn } from '@/lib/utils';

/** Ukuran berkas: 1.234.567 byte → "1,2 MB". */
function ukuran(n: number | null): string {
  if (n === null) return '—';
  if (n < 1024 * 1024) {
    return `${(n / 1024).toLocaleString('id-ID', { maximumFractionDigits: 0 })} KB`;
  }
  return `${(n / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}

const LABEL_TUJUAN: Record<StatusTujuanCadangan, string> = {
  BERHASIL: 'berhasil',
  GAGAL: 'gagal',
  NONAKTIF: 'tidak diatur',
};

function BadgeStatus({ b }: { b: BarisCadangan }) {
  const kelas =
    b.status === 'BERHASIL'
      ? 'bg-green-100 text-green-800'
      : b.status === 'GAGAL'
        ? 'bg-red-100 text-red-800'
        : 'bg-amber-100 text-amber-800';
  return (
    <Badge variant="outline" className={cn('border-0', kelas)}>
      {b.status === 'BERJALAN' ? 'Berjalan…' : b.status === 'BERHASIL' ? 'Berhasil' : 'Gagal'}
    </Badge>
  );
}

function labelPemicu(b: BarisCadangan): string {
  if (b.pemicu === 'JADWAL') return 'Jadwal';
  if (b.pemicu === 'MANUAL') return b.namaPengguna ?? 'Manual';
  return 'Sebelum pembaruan';
}

/** Peramban tidak boleh membuka folder komputer dari halaman web, jadi alamatnya disalin untuk Explorer. */
function SalinAlamat({ teks }: { teks: string }) {
  return (
    <button
      type="button"
      className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium hover:bg-slate-50"
      onClick={() =>
        void navigator.clipboard
          .writeText(teks)
          .then(() =>
            toast.success(
              'Alamat folder disalin. Di komputer server: buka File Explorer, klik kolom alamat di atas, tempel (Ctrl+V), Enter.',
            ),
          )
          .catch(() =>
            toast.error('Tidak bisa menyalin otomatis; pilih teks alamatnya lalu Ctrl+C.'),
          )
      }
    >
      <Copy className="size-3" /> Salin alamat folder
    </button>
  );
}

/** Di mana cadangan berada untuk tiap cara pemasangan server. */
function PenjelasanLokasi() {
  return (
    <Penjelasan judul="Di mana cadangan disimpan, dan bila server di cloud">
      <ButirPenjelasan>
        <li>
          <b>Isi folder cadangan terenkripsi</b> (restic, kata sandi <code>CADANGAN_SANDI</code>).
          Isinya tidak bisa dibaca langsung; hanya bisa dipulihkan dengan kata sandi itu. Simpan
          kata sandinya di tempat aman terpisah (mis. dicatat Owner), karena tanpa itu cadangan
          tidak bisa dibuka.
        </li>
        <li>
          <b>Server di komputer toko</b> (cara sekarang): folder <i>Lokal</i> ada di komputer server
          (sebaiknya disk kedua atau disk eksternal). Tombol <b>Salin alamat folder</b> menyalin
          alamatnya; tempel di File Explorer komputer server. Dari komputer kasir lain folder itu
          tidak terlihat, dan memang sengaja tidak dibagikan.
        </li>
        <li>
          <b>Server di cloud / hosting (VPS)</b>: folder <i>Lokal</i> berada di disk server sewaan,
          bukan di toko. Karena itu <b>tujuan Cloud wajib diisi</b> (Google Drive atau penyimpanan
          objek) agar salinan ada di luar server; bila hosting bermasalah, data dipulihkan dari
          Cloud ke server baru. Tanpa tujuan Cloud, cadangan hanya ada di server itu sendiri (kolom
          Cloud: "tidak diatur").
        </li>
        <li>
          <b>Memulihkan</b> tidak dilakukan dari halaman ini (agar tidak terpencet). Langkahnya ada
          di panduan pemasangan server, bagian Cadangan data. <b>Uji pulih</b> di bawah memastikan
          cadangan terakhir benar-benar bisa dibuka, tanpa mengubah data toko.
        </li>
        <li>
          <b>Sebelum pembaruan aplikasi</b> cadangan dibuat otomatis (pemicu "Sebelum pembaruan"),
          sehingga bila pembaruan gagal data bisa dikembalikan ke keadaan sebelumnya.
        </li>
      </ButirPenjelasan>
    </Penjelasan>
  );
}

/**
 * Pengaturan › Cadangan (Owner, docs/07 Fase 8, K-084): status cadangan terakhir, lokasi, retensi,
 * tombol cadangkan & uji pulih sekarang, dan riwayat. Lokasi & kata sandi diatur di .env server.
 */
export function TabCadangan() {
  const status = useStatusCadangan(true);
  const jalankan = useJalankanCadangan();
  const [ubahAturan, setUbahAturan] = useState(false);
  const s = status.data;
  if (!s) {
    return status.error ? (
      <p className="text-sm text-red-600">{pesanGalat(status.error)}</p>
    ) : (
      <Skeleton className="h-64 w-full" />
    );
  }

  function mulai(jenis: 'cadangan' | 'uji-pulih') {
    jalankan
      .mutateAsync(jenis)
      .then(() =>
        toast.success(
          jenis === 'cadangan'
            ? 'Cadangan dimulai. Status diperbarui otomatis.'
            : 'Uji pulih dimulai. Status diperbarui otomatis.',
        ),
      )
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  const t = s.terakhirBerhasil;
  const uji = s.ujiPulihTerakhir;
  return (
    <div className="space-y-4">
      {s.peringatan.length > 0 && (
        <Card className="flex-row gap-3 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="size-5 shrink-0" />
          <ul className="list-disc space-y-0.5 pl-4">
            {s.peringatan.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Card>
      )}

      {!s.aktif ? (
        <FormAturCadangan folderSekarang={null} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-1 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CheckCircle2 className={cn('size-4', t ? 'text-green-600' : 'text-slate-300')} />
              Cadangan terakhir berhasil
            </div>
            <div className="text-lg font-semibold" data-testid="cadangan-terakhir">
              {t ? formatWaktu(t.waktuMulai) : 'Belum ada'}
            </div>
            {t && (
              <div className="text-xs text-slate-500">
                Database {ukuran(t.ukuranDump)} · lokal{' '}
                {t.statusLokal ? LABEL_TUJUAN[t.statusLokal] : '—'} · cloud{' '}
                {t.statusCloud ? LABEL_TUJUAN[t.statusCloud] : '—'}
              </div>
            )}
          </Card>
          <Card className="gap-1 p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <HardDrive className="size-4 text-slate-500" /> Lokasi
              <span className="ml-auto">
                <PenjelasanLokasi />
              </span>
            </div>
            <div className="min-w-0">
              Lokal (di komputer server):
              <span className="block font-mono text-xs break-all">{s.repoLokal}</span>
              {s.repoLokal && <SalinAlamat teks={s.repoLokal} />}
            </div>
            <div className="min-w-0">
              <span className="flex items-center gap-1">
                <CloudUpload className="size-3.5 text-slate-500" /> Cloud:
              </span>
              {s.repoCloud ? (
                <span className="block font-mono text-xs break-all">{s.repoCloud}</span>
              ) : (
                'tidak diatur'
              )}
            </div>
          </Card>
          <Card className="gap-1 p-5 text-sm">
            <div className="font-semibold text-slate-700">Jadwal &amp; retensi</div>
            <div>Otomatis setiap hari pukul {String(s.jam).padStart(2, '0')}.00 WIB</div>
            <div className="text-xs text-slate-500">Disimpan: {s.retensi}</div>
            <div className="text-xs text-slate-500">
              Uji pulih otomatis tiap tanggal 1;{' '}
              {uji
                ? `terakhir ${formatWaktu(uji.waktuMulai)} (${uji.status.toLowerCase()})`
                : 'belum pernah'}
            </div>
          </Card>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => mulai('cadangan')}
          disabled={!s.aktif || s.sedangBerjalan || jalankan.isPending}
        >
          {s.sedangBerjalan ? <Loader2 className="animate-spin" /> : <DatabaseBackup />} Cadangkan
          sekarang
        </Button>
        <Button
          variant="outline"
          onClick={() => mulai('uji-pulih')}
          disabled={!s.aktif || s.sedangBerjalan || jalankan.isPending || !t}
        >
          Uji pulih sekarang
        </Button>
        {s.aktif && s.sumberAturan !== 'ENV' && (
          <Button variant="ghost" onClick={() => setUbahAturan((v) => !v)}>
            Ubah folder/sandi
          </Button>
        )}
      </div>
      {s.aktif && ubahAturan && (
        <FormAturCadangan folderSekarang={s.repoLokal} onSelesai={() => setUbahAturan(false)} />
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Mulai</th>
              <th className="px-3 py-2 text-left">Jenis</th>
              <th className="px-3 py-2 text-left">Pemicu</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Ukuran DB</th>
              <th className="px-3 py-2 text-left">Snapshot (lokal / cloud)</th>
              <th className="px-3 py-2 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {s.riwayat.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Belum ada riwayat cadangan.
                </td>
              </tr>
            )}
            {s.riwayat.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2 whitespace-nowrap">{formatWaktu(b.waktuMulai)}</td>
                <td className="px-3 py-2">{b.jenis === 'CADANGAN' ? 'Cadangan' : 'Uji pulih'}</td>
                <td className="px-3 py-2 text-xs">{labelPemicu(b)}</td>
                <td className="px-3 py-2">
                  <BadgeStatus b={b} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{ukuran(b.ukuranDump)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {b.snapshotLokal ?? '—'} / {b.snapshotCloud ?? '—'}
                </td>
                <td className="max-w-md px-3 py-2 text-xs text-slate-600">{b.pesan ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
