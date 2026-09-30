import type { Pelanggan, StatusAktif } from '@sit/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useDaftarPelanggan, useStatusPelanggan } from '@/api/mitra';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { BilahSaring, type SaringStatus } from '@/components/bilah-saring';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { jalankanDenganToast } from '@/lib/aksi';
import { useTunda } from '@/lib/use-tunda';
import { DialogPelanggan } from './dialog-pelanggan';

export function HalamanPelanggan() {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [status, setStatus] = useState<SaringStatus>('SEMUA');
  const [halaman, setHalaman] = useState(1);
  const [dialog, setDialog] = useState<{ pelanggan: Pelanggan | null } | null>(null);

  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPelanggan({
    cari: cariTertunda,
    status,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const ubahStatus = useStatusPelanggan();

  const kolom: KolomTabel<Pelanggan>[] = [
    {
      kunci: 'kode',
      judul: 'Kode',
      className: 'w-28',
      sel: (p) => <span className="font-mono text-xs text-slate-500">{p.kode}</span>,
    },
    {
      kunci: 'nama',
      judul: 'Nama pelanggan',
      sel: (p) => (
        <div>
          <div className="font-medium">{p.namaPelanggan}</div>
          {p.keterangan && <div className="text-xs text-slate-500">{p.keterangan}</div>}
        </div>
      ),
    },
    { kunci: 'hp', judul: 'No. HP', sel: (p) => p.noHp ?? '—' },
    {
      kunci: 'alamat',
      judul: 'Alamat',
      sel: (p) => (
        <span className="block max-w-64 truncate text-xs text-slate-500" title={p.alamat ?? ''}>
          {p.alamat ?? '—'}
        </span>
      ),
    },
    {
      kunci: 'tier',
      judul: 'Tier',
      sel: (p) =>
        p.namaTingkatHarga ? (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            {p.namaTingkatHarga}
          </Badge>
        ) : (
          <span className="text-xs text-slate-400">Default</span>
        ),
    },
    {
      kunci: 'term',
      judul: 'Term',
      className: 'text-right',
      sel: (p) => `${p.termHari} hari`,
    },
    { kunci: 'status', judul: 'Status', sel: (p) => <BadgeStatusAktif status={p.statusAktif} /> },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (p) => (
        <MenuAksiMaster
          nama={p.namaPelanggan}
          status={p.statusAktif}
          onUbah={() => setDialog({ pelanggan: p })}
          onUbahStatus={(statusAktif: StatusAktif) =>
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: p.id, statusAktif }),
              `Pelanggan ${p.namaPelanggan} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
            )
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Data Pelanggan</h1>
          <p className="text-sm text-slate-500">Kelola daftar pelanggan toko.</p>
        </div>
        <Button onClick={() => setDialog({ pelanggan: null })}>
          <Plus /> Tambah pelanggan
        </Button>
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
    </div>
  );
}
