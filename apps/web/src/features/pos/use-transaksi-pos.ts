import {
  tambahQty,
  type BarisBarang,
  type DetailOrder,
  type InputOrder,
  type JenisPenjualan,
  type Pelanggan,
} from '@sit/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  dariBarang,
  dariOrder,
  keBarisOrder,
  rapikanQty,
  subtotalBaris,
  type BarisPos,
} from './model';

export type PelangganPos = { id: number; nama: string; idTier: number | null };

export type TransaksiPos = {
  /** Order antrean yang sedang dibayar; `null` = jual langsung tanpa order. */
  order: DetailOrder | null;
  baris: BarisPos[];
  pelanggan: PelangganPos | null;
  namaPembeli: string;
  /** Isi/pelanggan berbeda dari order asal (checkout mengirim isi baru, R4/K-073). */
  diubah: boolean;
};

const KOSONG: TransaksiPos = {
  order: null,
  baris: [],
  pelanggan: null,
  namaPembeli: '',
  diubah: false,
};

/**
 * State satu transaksi layar POS: baris barang, pelanggan, dan order asal. Menghapus baris atau mengosongkan
 * transaksi bisa diurungkan (Ctrl+Z / tombol Urungkan) karena salah pencet sering terjadi di jam ramai.
 */
export function useTransaksiPos(tierDefault: number | null) {
  const [t, setT] = useState<TransaksiPos>(KOSONG);
  const [cadangan, setCadangan] = useState<TransaksiPos | null>(null);

  const tierBawaan = t.pelanggan?.idTier ?? t.order?.idTingkatHargaPelanggan ?? tierDefault;

  function simpanCadangan(pesan: string) {
    const salinan = t;
    setCadangan(salinan);
    toast(pesan, {
      duration: 8000,
      action: {
        label: 'Urungkan (Ctrl+Z)',
        onClick: () => {
          setT(salinan);
          setCadangan(null);
        },
      },
    });
  }

  function urungkan() {
    if (!cadangan) return;
    setT(cadangan);
    setCadangan(null);
  }

  function muatOrder(d: DetailOrder) {
    setT({
      order: d,
      baris: dariOrder(d),
      pelanggan: d.idPelanggan
        ? { id: d.idPelanggan, nama: d.namaPelanggan ?? '', idTier: d.idTingkatHargaPelanggan }
        : null,
      namaPembeli: d.namaPembeli ?? '',
      diubah: false,
    });
    setCadangan(null);
  }

  /**
   * Menambah barang; barang yang sudah ada digabung qty-nya (scan berulang) bila satuannya sama. Satu barang
   * satu baris (K-091): pindai satuan lain untuk barang yang sudah ada hanya memberi tahu kasir.
   * Mengembalikan indeks baris.
   */
  function tambah(b: BarisBarang, qty: string, idSatuanJual?: number | null): number {
    const ada = t.baris.findIndex((x) => x.idBarang === b.id);
    const lama = t.baris[ada];
    // Satuan yang diminta: dipilih di hasil cari, atau barcode satuan jual yang dipindai.
    const diminta = idSatuanJual !== undefined ? idSatuanJual : (b.idSatuanJualCocok ?? undefined);
    if (lama && diminta !== undefined && diminta !== lama.idSatuanJual) {
      toast.info(
        `${b.namaBarang} sudah ada dalam satuan ${lama.satuan}. Ubah qty-nya, atau tekan S untuk ganti satuan.`,
      );
      return ada;
    }
    if (ada >= 0) {
      const qtyBaru = rapikanQty(tambahQty(t.baris[ada]?.qty ?? '0', qty));
      setT({
        ...t,
        diubah: true,
        baris: t.baris.map((x, i) => (i === ada ? { ...x, qty: qtyBaru } : x)),
      });
      return ada;
    }
    setT({ ...t, diubah: true, baris: [...t.baris, dariBarang(b, qty, idSatuanJual)] });
    return t.baris.length;
  }

  function ubah(i: number, ubahan: Partial<BarisPos>) {
    setT({ ...t, diubah: true, baris: t.baris.map((x, j) => (j === i ? { ...x, ...ubahan } : x)) });
  }

  function hapus(i: number) {
    const b = t.baris[i];
    if (!b) return;
    simpanCadangan(`${b.nama} dihapus.`);
    setT({ ...t, diubah: true, baris: t.baris.filter((_, j) => j !== i) });
  }

  function aturPelanggan(p: Pelanggan | null) {
    setT({
      ...t,
      diubah: true,
      pelanggan: p ? { id: p.id, nama: p.namaPelanggan, idTier: p.idTingkatHarga } : null,
    });
  }

  function aturNamaPembeli(nama: string) {
    setT({ ...t, namaPembeli: nama, diubah: t.order ? true : t.diubah });
  }

  /** Kosongkan transaksi; `bisaDiurungkan` untuk F9 pada keranjang yang sudah berisi. */
  function kosongkan(bisaDiurungkan = false) {
    if (bisaDiurungkan && t.baris.length > 0) simpanCadangan('Transaksi dikosongkan.');
    else setCadangan(null);
    setT(KOSONG);
  }

  /** Perkiraan total di layar: order yang tidak diubah memakai total order (pasti). */
  const total =
    t.order && !t.diubah
      ? t.order.total
      : t.baris.reduce((s, b) => s + subtotalBaris(b, tierBawaan), 0) -
        (t.order?.diskonTransaksi ?? 0) +
        (t.order?.ongkir ?? 0);

  /** Isi order untuk API (dibuat baru, atau menggantikan isi order asal). */
  function isianOrder(jenis: JenisPenjualan): InputOrder {
    return {
      jenisPenjualan: t.order?.jenisPenjualan ?? jenis,
      idPelanggan: t.pelanggan?.id ?? null,
      namaPembeli: t.pelanggan ? null : t.namaPembeli.trim() || null,
      prioritas: t.order?.prioritas ?? 'NORMAL',
      alamatKirim: t.order?.alamatKirim ?? null,
      catatanKirim: t.order?.catatanKirim ?? null,
      ongkir: t.order?.ongkir ?? 0,
      diskonTransaksi: t.order?.diskonTransaksi ?? 0,
      catatan: t.order?.catatan ?? null,
      baris: t.baris.map(keBarisOrder),
    };
  }

  return {
    t,
    tierBawaan,
    total,
    muatOrder,
    tambah,
    ubah,
    hapus,
    aturPelanggan,
    aturNamaPembeli,
    kosongkan,
    urungkan,
    adaCadangan: cadangan !== null,
    isianOrder,
  };
}
