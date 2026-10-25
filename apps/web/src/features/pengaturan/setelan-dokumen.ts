import type { Pengaturan } from '@sit/shared';

/** K-124: kolom profil yang diatur di kartu Dokumen & kertas. */
export function ambilSetelanDokumen(p: Pengaturan['profil']) {
  return {
    invoiceCetak: p.invoiceCetak,
    suratJalanCetak: p.suratJalanCetak,
    kertasInvoice: p.kertasInvoice,
    kertasSuratJalan: p.kertasSuratJalan,
    kertasDokumenLain: p.kertasDokumenLain,
    suratJalanRangkap: p.suratJalanRangkap,
  };
}
