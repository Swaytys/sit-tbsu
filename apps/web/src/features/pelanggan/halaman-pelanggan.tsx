import { formatRupiah, type Pelanggan, type StatusAktif } from '@sit/shared';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { useCariUrl } from '@/lib/use-cari-url';
import { TeksLipat } from '@/components/teks-lipat';
import { pesanGalat } from '@/api/client';
import { useDaftarPelanggan, useMintaKodePelanggan, useStatusPelanggan } from '@/api/mitra';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { BilahSaring, type SaringStatus } from '@/components/bilah-saring';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { DialogKodeAtasan } from '@/components/dialog-kode-atasan';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { jalankanDenganToast } from '@/lib/aksi';
import { formatTanggal } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { DialogGolongan } from './dialog-golongan';
import { DialogPelanggan } from './dialog-pelanggan';
import { useIngat } from '@/lib/ingat-saring';

/** Jatuh tempo terdekat beserta jaraknya dari hari ini (K-107). Angka dari API; di sini hanya ditampilkan. */
function SelJatuhTempo({ p }: { p: Pelanggan }) {
  const { jatuhTempoTerdekat: tgl, hariKeJatuhTempo: hari } = p.kredit;
  if (tgl === null || hari === null) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="leading-tight">
      <div className="tabular-nums">{formatTanggal(tgl)}</div>
      {hari < 0 ? (
        <Badge
          variant="outline"
          className="border-red-200 bg-red-50 text-red-700"
          title={`Tagihan yang sudah lewat jatuh tempo: ${formatRupiah(p.kredit.piutangTerlambat)}`}
        >
          terlambat {-hari} hari
        </Badge>
      ) : hari === 0 ? (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
          jatuh tempo hari ini
        </Badge>
      ) : (
        <span
          className={hari <= 3 ? 'text-xs font-medium text-amber-700' : 'text-xs text-slate-500'}
        >
          {hari} hari lagi
        </span>
      )}
    </div>
  );
}

export function HalamanPelanggan() {
  const [cari, setCari] = useCariUrl('pelanggan');
  const cariTertunda = useTunda(cari, 300);
  const [status, setStatus] = useIngat<SaringStatus>('pelanggan.status', 'SEMUA');
  const [halaman, setHalaman] = useIngat('pelanggan.halaman', 1);
  const [dialog, setDialog] = useState<{ pelanggan: Pelanggan | null } | null>(null);
  const [dialogGolongan, setDialogGolongan] = useState(false);
  const bolehKredit = usePengguna().izin.includes('master.pelanggan.atur_kredit');
  /** K-107: nonaktif/aktifkan oleh pengguna tanpa izin atur kredit menunggu kode atasan. */
  const [statusKode, setStatusKode] = useState<{ p: Pelanggan; statusAktif: StatusAktif } | null>(
    null,
  );

  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPelanggan({
    cari: cariTertunda,
    status,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const ubahStatus = useStatusPelanggan();
  const mintaKode = useMintaKodePelanggan();

  const pesanStatus = (p: Pelanggan, s: StatusAktif) =>
    `Pelanggan ${p.namaPelanggan} ${s === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`;

  const kolom: KolomTabel<Pelanggan>[] = [
    {
      kunci: 'kode',
      judul: 'Kode · status',
      className: 'w-28',
      // Status ditaruh di bawah kode supaya tabel muat di layar 1280 px tanpa digulir ke samping.
      sel: (p) => (
        <div className="space-y-0.5">
          <div className="font-mono text-xs text-slate-500">{p.kode}</div>
          <BadgeStatusAktif status={p.statusAktif} />
        </div>
      ),
    },
    {
      kunci: 'nama',
      judul: 'Pelanggan',
      sel: (p) => (
        <div className="max-w-60">
          <div className="font-medium">{p.namaPelanggan}</div>
          <TeksLipat
            teks={`${p.noHp ?? 'tanpa No. HP'}${p.alamat ? ` · ${p.alamat}` : ''}`}
            className="text-xs text-slate-500"
          />
          {p.keterangan && <TeksLipat teks={p.keterangan} className="text-xs text-slate-400" />}
        </div>
      ),
    },
    {
      kunci: 'golongan',
      judul: 'Golongan · term',
      sel: (p) => (
        <div className="leading-tight">
          {p.namaGolongan ? (
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              {p.namaGolongan}
            </Badge>
          ) : (
            <span className="text-xs text-slate-400">tanpa golongan</span>
          )}
          <div className="text-xs text-slate-500">term {p.termHari} hari</div>
        </div>
      ),
    },
    {
      kunci: 'limit',
      judul: 'Limit kredit · sisa',
      className: 'text-right',
      // Limit dan sisanya dalam satu kolom supaya tabel muat di layar 1280 px tanpa digulir ke samping.
      sel: (p) =>
        p.limitKredit === null || p.kredit.sisaLimit === null ? (
          <span className="text-xs text-slate-400">tanpa limit</span>
        ) : (
          <div className="leading-tight">
            <div className="tabular-nums">{formatRupiah(p.limitKredit)}</div>
            {p.kredit.sisaLimit < 0 ? (
              <div className="text-xs font-semibold text-red-600 tabular-nums">
                melewati limit {formatRupiah(-p.kredit.sisaLimit)}
              </div>
            ) : (
              <div
                className={
                  p.kredit.sisaLimit === 0
                    ? 'text-xs font-semibold text-amber-700 tabular-nums'
                    : 'text-xs text-slate-500 tabular-nums'
                }
              >
                sisa {formatRupiah(p.kredit.sisaLimit)}
              </div>
            )}
          </div>
        ),
    },
    {
      kunci: 'tagihan',
      judul: 'Tagihan berjalan',
      className: 'text-right',
      sel: (p) =>
        p.kredit.piutang === 0 ? (
          <span className="text-xs text-slate-400">tidak ada</span>
        ) : (
          <div className="leading-tight">
            <div className="font-semibold tabular-nums">{formatRupiah(p.kredit.piutang)}</div>
            <div className="text-xs text-slate-500">{p.kredit.jumlahNota} nota belum lunas</div>
          </div>
        ),
    },
    { kunci: 'tempo', judul: 'Jatuh tempo', sel: (p) => <SelJatuhTempo p={p} /> },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (p) => (
        <MenuAksiMaster
          nama={p.namaPelanggan}
          status={p.statusAktif}
          onUbah={() => setDialog({ pelanggan: p })}
          onUbahStatus={(statusAktif: StatusAktif) => {
            if (!bolehKredit) {
              setStatusKode({ p, statusAktif });
              return;
            }
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: p.id, statusAktif }),
              pesanStatus(p, statusAktif),
            );
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-xl font-semibold text-slate-900">Data Pelanggan</h1>
          <p className="text-sm text-slate-500">
            Daftar pelanggan beserta limit kredit, tagihan berjalan, dan jatuh temponya.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Penjelasan judul="Arti kolom Data Pelanggan">
            <ButirPenjelasan>
              <li>
                <b>Golongan · term</b>: golongan dipakai untuk sasaran promo; term = jumlah hari
                dari tanggal transaksi sampai tagihan jatuh tempo.
              </li>
              <li>
                <b>Limit kredit · sisa</b>: baris atas = batas total tagihan belum lunas yang boleh
                dimiliki pelanggan (&quot;tanpa limit&quot; = tidak dibatasi). Baris bawah = sisa
                limit, yaitu limit dikurangi tagihan berjalan. Tulisan merah &quot;melewati
                limit&quot; berarti tagihannya sudah lebih besar dari limit sebesar angka itu;
                penjualan tidak lunas berikutnya butuh persetujuan Admin/Owner.
              </li>
              <li>
                <b>Tagihan berjalan</b>: jumlah sisa tagihan semua nota pelanggan ini yang belum
                lunas (penjualan yang di-void tidak dihitung). Rinciannya ada di menu Piutang.
              </li>
              <li>
                <b>Jatuh tempo</b>: tanggal jatuh tempo paling awal di antara nota yang belum lunas.
                &quot;N hari lagi&quot; = belum jatuh tempo; &quot;terlambat N hari&quot; = sudah
                lewat N hari dan belum dilunasi.
              </li>
              <li>
                <b>Status</b> (di bawah kode): pelanggan nonaktif tidak bisa dipilih pada transaksi
                baru; datanya dan riwayatnya tetap ada.
              </li>
              <li>
                <b>Siapa boleh apa</b>: semua peran boleh menambah pelanggan baru. Golongan, term,
                dan limit kredit hanya diatur Admin/Owner. Kasir dan Staf Penjualan yang ingin
                mengubah data pelanggan yang sudah ada, menonaktifkan, atau mengaktifkannya kembali
                harus memasukkan kode sekali pakai yang dikirim sistem ke Admin/Owner.
              </li>
            </ButirPenjelasan>
          </Penjelasan>
          {bolehKredit && (
            <Button variant="outline" onClick={() => setDialogGolongan(true)}>
              <Users /> Golongan
            </Button>
          )}
          <Button onClick={() => setDialog({ pelanggan: null })}>
            <Plus /> Tambah pelanggan
          </Button>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <BilahSaring
          cari={cari}
          onCari={(v) => {
            setCari(v);
            setHalaman(1);
          }}
          status={status}
          onStatus={(v) => {
            setStatus(v);
            setHalaman(1);
          }}
          placeholder="Cari nama, kode, atau No. HP…"
          label="Cari pelanggan"
        />
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(p) => p.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Tidak ada pelanggan yang cocok."
        />
      </Card>

      {dialog && <DialogPelanggan pelanggan={dialog.pelanggan} onTutup={() => setDialog(null)} />}
      {dialogGolongan && <DialogGolongan onTutup={() => setDialogGolongan(false)} />}
      {statusKode && (
        <DialogKodeAtasan
          judul={
            statusKode.statusAktif === 'AKTIF'
              ? 'Persetujuan mengaktifkan pelanggan'
              : 'Persetujuan menonaktifkan pelanggan'
          }
          ringkasan={
            <>
              {statusKode.statusAktif === 'AKTIF' ? 'Aktifkan kembali' : 'Nonaktifkan'} pelanggan{' '}
              <b>{statusKode.p.namaPelanggan}</b> ({statusKode.p.kode}). Tagihan berjalan:{' '}
              {formatRupiah(statusKode.p.kredit.piutang)}.
            </>
          }
          mintaKode={() =>
            mintaKode.mutateAsync({
              id: statusKode.p.id,
              json: { aksi: 'STATUS', statusAktif: statusKode.statusAktif },
            })
          }
          kunci={`pelanggan-status:${statusKode.p.id}:${statusKode.statusAktif}`}
          memproses={ubahStatus.isPending}
          onTutup={() => setStatusKode(null)}
          onSetujui={(kodeAtasan) =>
            void ubahStatus
              .mutateAsync({
                id: statusKode.p.id,
                statusAktif: statusKode.statusAktif,
                kodeAtasan,
              })
              .then(() => {
                toast.success(pesanStatus(statusKode.p, statusKode.statusAktif));
                setStatusKode(null);
              })
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
        />
      )}
    </div>
  );
}
