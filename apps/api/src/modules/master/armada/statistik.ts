import { sql } from 'drizzle-orm';
import type { StatistikArmada, StatistikKendaraan, StatistikSopir } from '@sit/shared';
import { db } from '../../../db/client';
import { saatLokal, tambahHari } from '../../../lib/waktu';

/*
 * Statistik armada (K-162, docs/13 §5.3). Rit = perjalanan yang berangkat (JALAN/SELESAI) dalam periode menurut
 * tanggal lokal toko; BBM dan servis menurut tanggal catatannya, tanpa yang batal. Semua angka dihitung database
 * dengan parameter terikat. Ketepatan: rit rencana yang berangkat paling lambat 30 menit setelah jadwal.
 */

const TOLERANSI_TELAT = '30 minutes';

type BarisRit = {
  rit: number;
  surat_jalan: number;
  rata_lama: number | null;
  tepat: number;
  berjadwal: number;
};

const keRit = (r: BarisRit) => ({
  rit: r.rit,
  suratJalan: r.surat_jalan,
  rataLamaMenit: r.rata_lama,
  tepatWaktu: r.tepat,
  berjadwal: r.berjadwal,
});

export async function statistikArmada(dari: string, sampai: string): Promise<StatistikArmada> {
  const awal = saatLokal(dari, '00:00');
  const akhir = saatLokal(tambahHari(sampai, 1), '00:00');
  const rit = sql`
    rit as (
      select p.id, p.id_kendaraan, p.id_sopir, p.status, p.waktu_berangkat, p.waktu_kembali,
        p.jadwal_berangkat, p.muatan_berat_kg,
        (select count(*) from surat_jalan sj where sj.id_perjalanan = p.id) as sj
      from perjalanan p
      where p.status in ('JALAN', 'SELESAI') and p.waktu_berangkat >= ${awal} and p.waktu_berangkat < ${akhir}
    )`;
  const ringkasRit = sql`
    count(r.id)::int as rit,
    coalesce(sum(r.sj), 0)::int as surat_jalan,
    round(avg(extract(epoch from r.waktu_kembali - r.waktu_berangkat) / 60)
      filter (where r.status = 'SELESAI'))::int as rata_lama,
    (count(r.id) filter (where r.jadwal_berangkat is not null
      and r.waktu_berangkat <= r.jadwal_berangkat + ${TOLERANSI_TELAT}::interval))::int as tepat,
    (count(r.id) filter (where r.jadwal_berangkat is not null))::int as berjadwal`;

  const kendaraan = await db.execute<
    BarisRit & {
      id: number;
      plat: string;
      jenis: string;
      muatan: string;
      pakai: number | null;
      liter: string | null;
      bbm_rp: string | null;
      servis_rp: string | null;
      km: number | null;
    }
  >(sql`
    with ${rit},
    bbm as (
      select id_kendaraan, sum(liter) as liter, sum(total_rp) as rp from catatan_bbm
      where batal_pada is null and tanggal between ${dari} and ${sampai} group by id_kendaraan
    ),
    servis as (
      select id_kendaraan, sum(biaya_rp) as rp from catatan_servis
      where batal_pada is null and tanggal between ${dari} and ${sampai} group by id_kendaraan
    ),
    odo as (
      select id_kendaraan, max(odometer_km) - min(odometer_km) as km from (
        select id_kendaraan, odometer_km from catatan_bbm
        where batal_pada is null and odometer_km is not null and tanggal between ${dari} and ${sampai}
        union all
        select id_kendaraan, odometer_km from catatan_servis
        where batal_pada is null and odometer_km is not null and tanggal between ${dari} and ${sampai}
      ) x group by id_kendaraan
    )
    select k.id, k.plat, k.jenis, ${ringkasRit},
      coalesce(sum(r.muatan_berat_kg), 0)::text as muatan,
      round(avg(r.muatan_berat_kg * 100 / nullif(k.kapasitas_kg, 0)))::int as pakai,
      b.liter::text as liter, b.rp::text as bbm_rp, s.rp::text as servis_rp,
      nullif(o.km, 0)::int as km
    from kendaraan k
    left join rit r on r.id_kendaraan = k.id
    left join bbm b on b.id_kendaraan = k.id
    left join servis s on s.id_kendaraan = k.id
    left join odo o on o.id_kendaraan = k.id
    group by k.id, b.liter, b.rp, s.rp, o.km
    having k.status_aktif = 'AKTIF' or count(r.id) > 0 or b.liter is not null or s.rp is not null
    order by k.plat
  `);

  const sopir = await db.execute<BarisRit & { id: number; nama: string; bermasalah: number }>(sql`
    with ${rit},
    masalah as (
      select distinct sj.id_perjalanan, sj.id from surat_jalan sj
      join surat_jalan_hasil h on h.id_surat_jalan = sj.id
      join surat_jalan_hasil_detail d on d.id_hasil = h.id
      where d.qty_kembali + d.qty_rusak + d.qty_ditolak > 0
    )
    select s.id, s.nama, ${ringkasRit},
      (select count(*) from masalah m join rit r2 on r2.id = m.id_perjalanan
        where r2.id_sopir = s.id)::int as bermasalah
    from sopir s
    left join rit r on r.id_sopir = s.id
    group by s.id
    having s.status_aktif = 'AKTIF' or count(r.id) > 0
    order by s.nama
  `);

  return {
    dari,
    sampai,
    kendaraan: kendaraan.rows.map((k): StatistikKendaraan => {
      const bbmRp = Number(k.bbm_rp ?? 0);
      const servisRp = Number(k.servis_rp ?? 0);
      const liter = k.liter ?? '0';
      return {
        idKendaraan: k.id,
        plat: k.plat,
        jenis: k.jenis,
        ...keRit(k),
        muatanKg: k.muatan,
        rataPakaiPersen: k.pakai,
        bbmLiter: liter,
        bbmRp,
        kmTempuh: k.km,
        kmPerLiter: k.km !== null && Number(liter) > 0 ? (k.km / Number(liter)).toFixed(1) : null,
        servisRp,
        biayaPerKm: k.km !== null ? Math.round((bbmRp + servisRp) / k.km) : null,
      };
    }),
    sopir: sopir.rows.map((s): StatistikSopir => ({
      idSopir: s.id,
      nama: s.nama,
      ...keRit(s),
      suratJalanBermasalah: s.bermasalah,
    })),
  };
}
