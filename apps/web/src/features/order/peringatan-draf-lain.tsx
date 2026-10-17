import { bandingQty, tambahQty, type BarisBarang, type DrafBarang } from '@sit/shared';
import { useState } from 'react';
import { ambilDrafBarang } from '@/api/penjualan';
import { DialogDrafLain, type HasilCekDraf, type TanyaDraf } from './dialog-draf-lain';

export type { HasilCekDraf } from './dialog-draf-lain';

/**
 * K-122 butir 4 (docs/05 R14): setelah barang ditambahkan (tanpa menunggu, agar input cepat tidak tersendat),
 * draf lain yang memuat barang yang sama diperiksa. Draf tidak menahan stok, jadi bila stok tersedia tidak
 * cukup untuk semuanya, pengguna diberi tahu draf mana (pembeli yang datang lebih dulu) dan memilih: biarkan,
 * hapus lagi dari order ini, atau buka draf itu. Gagal memeriksa (mis. jaringan) = dibiarkan.
 */
/** `fokusSesudah`: id elemen yang difokus lagi setelah dialog tertutup (kotak cari barang). */
export function useCekDrafLain(fokusSesudah?: string) {
  const [tanya, setTanya] = useState<TanyaDraf | null>(null);

  async function periksa(
    b: BarisBarang,
    qtyDasarDiminta: string,
    kecuali: number | null,
  ): Promise<HasilCekDraf> {
    let info: DrafBarang;
    try {
      info = await ambilDrafBarang(b.id, kecuali);
    } catch {
      return { aksi: 'BIARKAN' };
    }
    if (info.draf.length === 0) return { aksi: 'BIARKAN' };
    const diDraf = info.draf.reduce((n, d) => tambahQty(n, d.qtyDasar), '0');
    if (bandingQty(tambahQty(diDraf, qtyDasarDiminta), info.stokTersedia) <= 0) {
      return { aksi: 'BIARKAN' };
    }
    return new Promise((selesai) => setTanya({ b, info, diminta: qtyDasarDiminta, selesai }));
  }

  function pilih(h: HasilCekDraf) {
    tanya?.selesai(h);
    setTanya(null);
  }

  const dialog = tanya ? (
    <DialogDrafLain t={tanya} onPilih={pilih} fokusSesudah={fokusSesudah} />
  ) : null;
  return { periksa, dialog };
}
