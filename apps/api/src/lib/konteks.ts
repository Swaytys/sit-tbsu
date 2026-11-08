import type { Izin, Peran } from '@sit/shared';

/** Pengguna yang sedang login, dimuat middleware `muatSesi` dari cookie sesi. */
export type PenggunaAktif = {
  id: number;
  kode: string;
  username: string;
  namaPengguna: string;
  peran: Peran;
  /** K-243: nama peran khusus bila akun memakainya. */
  namaPeranKustom?: string | null;
  izin: ReadonlySet<Izin>;
  wajibGantiPassword: boolean;
  idSesi: number;
};

/** Informasi request untuk log aktivitas. */
export type AsalRequest = { ip: string | null; userAgent: string | null };

/** Tipe lingkungan Hono untuk seluruh aplikasi: `c.var.pengguna`, `c.var.asal`. */
export type EnvApp = {
  /** K-229: `jalurLan` diisi server HTTPS LAN (lihat modules/sistem/akses/lan.ts). */
  Bindings: { jalurLan?: boolean };
  Variables: {
    pengguna: PenggunaAktif | null;
    asal: AsalRequest;
  };
};
