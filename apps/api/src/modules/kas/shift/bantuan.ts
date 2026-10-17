import {
  formatRupiah,
  LABEL_METODE_PEMBAYARAN,
  PECAHAN_UANG,
  type BantuanSelisih,
  type BarisLinimasaTunai,
  type JenisKasShift,
  type MetodePembayaran,
  type PetunjukSelisih,
} from '@sit/shared';

/*
 * Bantuan mencari sebab selisih kas (K-121 butir 7) dan linimasa tunai shift. Fungsi murni: data shift masuk,
 * saran keluar. Saran, bukan tuduhan; tidak mengubah data.
 */

export type BayarShift = {
  tanggal: Date;
  metode: MetodePembayaran;
  nominal: number;
  uangDiterima: number | null;
  kembalian: number;
  nomorPenjualan: string;
};

export type KasShiftRingkas = {
  waktu: Date;
  jenis: JenisKasShift;
  arah: 'MASUK' | 'KELUAR';
  nominal: number;
  keterangan: string | null;
  nomorDokumen: string | null;
};

const LABEL_KAS: Record<JenisKasShift, string> = {
  KASBON: 'Kasbon',
  SETOR_OWNER: 'Setor ke owner',
  TARIK_OWNER: 'Tambahan dari owner',
  REFUND_RETUR: 'Refund retur',
  REFUND_VOID: 'Refund void',
  BAYAR_PEMASOK: 'Bayar pemasok',
  MASUK_LAIN: 'Kas masuk lain',
  KELUAR_LAIN: 'Kas keluar lain',
  KOREKSI_MODAL_TAMBAH: 'Koreksi modal (+)',
  KOREKSI_MODAL_KURANG: 'Koreksi modal (−)',
};

export function labelKas(k: Pick<KasShiftRingkas, 'jenis' | 'keterangan'>): string {
  return k.keterangan ? `${LABEL_KAS[k.jenis]}: ${k.keterangan}` : LABEL_KAS[k.jenis];
}

/** Setiap uang tunai yang masuk/keluar laci, urut waktu, dengan saldo laci menurut sistem sesudahnya. */
export function linimasaTunai(
  modalAwal: number,
  waktuBuka: Date,
  bayar: BayarShift[],
  kas: KasShiftRingkas[],
): BarisLinimasaTunai[] {
  type Kejadian = Omit<BarisLinimasaTunai, 'saldo'> & { t: number };
  const semua: Kejadian[] = [
    ...bayar
      .filter((b) => b.metode === 'TUNAI')
      .map((b) => ({
        t: b.tanggal.getTime(),
        waktu: b.tanggal.toISOString(),
        jenis: 'BAYAR' as const,
        label: `Penjualan ${b.nomorPenjualan}`,
        nomor: b.nomorPenjualan,
        masuk: b.nominal,
        keluar: 0,
        uangDiterima: b.uangDiterima,
        kembalian: b.kembalian,
      })),
    ...kas.map((k) => ({
      t: k.waktu.getTime(),
      waktu: k.waktu.toISOString(),
      jenis: 'KAS' as const,
      label: labelKas(k),
      nomor: k.nomorDokumen,
      masuk: k.arah === 'MASUK' ? k.nominal : 0,
      keluar: k.arah === 'KELUAR' ? k.nominal : 0,
      uangDiterima: null,
      kembalian: null,
    })),
  ].sort((a, b) => a.t - b.t);
  let saldo = modalAwal;
  const hasil: BarisLinimasaTunai[] = [
    {
      waktu: waktuBuka.toISOString(),
      jenis: 'MODAL',
      label: 'Modal awal',
      nomor: null,
      masuk: modalAwal,
      keluar: 0,
      uangDiterima: null,
      kembalian: null,
      saldo,
    },
  ];
  for (const e of semua) {
    saldo += e.masuk - e.keluar;
    hasil.push({
      waktu: e.waktu,
      jenis: e.jenis,
      label: e.label,
      nomor: e.nomor,
      masuk: e.masuk,
      keluar: e.keluar,
      uangDiterima: e.uangDiterima,
      kembalian: e.kembalian,
      saldo,
    });
  }
  return hasil;
}

const PERIKSA_KURANG = [
  'Uang yang keluar dari laci tetapi belum dicatat: kasbon, beli keperluan toko, setor ke owner.',
  'Kembalian yang diberikan berlebih, atau uang pecahan besar dikira pecahan kecil.',
  'Pembayaran yang dicatat Tunai padahal pembeli membayar lewat transfer/EDC/QRIS.',
  'Uang yang terselip di luar laci (bawah laci, dompet kasir, meja).',
];

const PERIKSA_LEBIH = [
  'Penjualan tunai yang uangnya diterima tetapi belum dicatat di aplikasi.',
  'Pembayaran yang dicatat Transfer/EDC/QRIS padahal pembeli membayar tunai.',
  'Kembalian yang belum diberikan atau tidak diambil pembeli.',
  'Uang pribadi atau uang lain yang ikut terhitung.',
];

/**
 * Mencocokkan nilai selisih (uang fisik − saldo sistem) dengan kejadian di shift. Petunjuk paling banyak 8,
 * urut dari yang paling mungkin (cocok persis dengan satu kejadian), lalu kelipatan pecahan uang.
 */
export function bantuanSelisih(
  selisih: number,
  toleransi: number,
  bayar: BayarShift[],
  kas: KasShiftRingkas[],
): BantuanSelisih {
  const nilai = Math.abs(selisih);
  if (selisih === 0) return { selisih, dalamToleransi: true, petunjuk: [], periksa: [] };
  if (nilai <= toleransi) {
    return {
      selisih,
      dalamToleransi: true,
      petunjuk: [],
      periksa: [
        `Selisih ${formatRupiah(nilai)} masih dalam toleransi ${formatRupiah(toleransi)}: biasanya dari pembulatan kembalian atau uang receh.`,
      ],
    };
  }
  const p: PetunjukSelisih[] = [];
  const tunai = bayar.filter((b) => b.metode === 'TUNAI');
  const nonTunai = bayar.filter((b) => b.metode !== 'TUNAI');
  if (selisih < 0) {
    for (const b of tunai.filter((x) => x.nominal === nilai)) {
      p.push({
        judul: `Sama dengan pembayaran tunai ${b.nomorPenjualan} (${formatRupiah(b.nominal)})`,
        rincian:
          'Periksa apakah uangnya benar-benar masuk laci, atau pembeli sebenarnya membayar lewat transfer/EDC/QRIS.',
        nomor: b.nomorPenjualan,
      });
    }
    for (const b of tunai.filter((x) => x.kembalian === nilai && x.kembalian > 0)) {
      p.push({
        judul: `Sama dengan kembalian ${b.nomorPenjualan} (${formatRupiah(b.kembalian)})`,
        rincian:
          'Mungkin kembalian diberikan dua kali, atau pembeli memberi uang lebih kecil dari yang diketik.',
        nomor: b.nomorPenjualan,
      });
    }
    for (const k of kas.filter((x) => x.arah === 'MASUK' && x.nominal === nilai)) {
      p.push({
        judul: `Sama dengan ${labelKas(k)} (${formatRupiah(k.nominal)})`,
        rincian: 'Kas masuk ini tercatat; periksa apakah uangnya benar-benar dimasukkan ke laci.',
        nomor: k.nomorDokumen,
      });
    }
  } else {
    for (const b of nonTunai.filter((x) => x.nominal === nilai)) {
      p.push({
        judul: `Sama dengan pembayaran ${LABEL_METODE_PEMBAYARAN[b.metode]} ${b.nomorPenjualan} (${formatRupiah(b.nominal)})`,
        rincian: 'Mungkin pembeli sebenarnya membayar tunai tetapi tercatat non-tunai.',
        nomor: b.nomorPenjualan,
      });
    }
    for (const b of tunai.filter((x) => x.kembalian === nilai && x.kembalian > 0)) {
      p.push({
        judul: `Sama dengan kembalian ${b.nomorPenjualan} (${formatRupiah(b.kembalian)})`,
        rincian: 'Mungkin kembalian ini belum diberikan atau tidak diambil pembeli.',
        nomor: b.nomorPenjualan,
      });
    }
    for (const k of kas.filter((x) => x.arah === 'KELUAR' && x.nominal === nilai)) {
      p.push({
        judul: `Sama dengan ${labelKas(k)} (${formatRupiah(k.nominal)})`,
        rincian:
          'Kas keluar ini tercatat; periksa apakah uangnya benar-benar sudah diambil dari laci.',
        nomor: k.nomorDokumen,
      });
    }
  }
  // Kelipatan satu pecahan besar (≤ 5 lembar): uang terselip atau salah hitung lembaran.
  const pecahan = PECAHAN_UANG.find((x) => x >= 10000 && nilai % x === 0 && nilai / x <= 5);
  if (pecahan) {
    const n = nilai / pecahan;
    p.push({
      judul: `${n} lembar Rp ${formatRupiah(pecahan).replace('Rp ', '')}`,
      rincian:
        selisih < 0
          ? `Selisih pas ${n} lembar ${formatRupiah(pecahan)}: periksa uang terselip atau lembaran yang terlewat dihitung.`
          : `Lebih pas ${n} lembar ${formatRupiah(pecahan)}: periksa uang lain yang ikut terhitung atau lembaran terhitung dua kali.`,
      nomor: null,
    });
  }
  return {
    selisih,
    dalamToleransi: false,
    petunjuk: p.slice(0, 8),
    periksa: selisih < 0 ? PERIKSA_KURANG : PERIKSA_LEBIH,
  };
}
