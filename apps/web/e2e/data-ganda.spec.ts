import { expect, test } from '@playwright/test';
import { api, masukCepat } from './pembantu';

// K-199: pelanggan sama persis (nama + No. HP) tidak bisa disimpan; yang belum pernah dipakai dihapus permanen.
test('Pelanggan ganda persis: tidak ada "tetap simpan"; hapus data lama yang belum dipakai lalu simpan', async ({
  page,
}) => {
  const kode = Date.now() % 1_000_000;
  const nama = `Bu Ganda E2E ${kode}`;
  const hp = `0813${String(kode).padStart(8, '0')}`;
  await masukCepat(page, 'ADMIN');
  const lama = await api<{ id: number }>(page, '/pelanggan', 'POST', {
    namaPelanggan: nama,
    noHp: hp,
  });
  await api(page, `/pelanggan/${lama.id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  const dibuat: number[] = [];
  try {
    await page.goto('/pelanggan');
    await page.getByRole('button', { name: 'Tambah pelanggan' }).click();
    const d = page.getByRole('dialog', { name: 'Tambah pelanggan' });
    await d.getByLabel('Nama pelanggan').fill(nama);
    await d.getByLabel('No. HP').fill(hp);
    await d.getByRole('button', { name: 'Simpan', exact: true }).click();
    const panel = d.getByTestId('panel-ganda');
    await expect(panel).toContainText('sama persis');
    await expect(d.getByRole('button', { name: /tetap simpan/ })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Hapus data itu' }).click();
    await page.getByRole('button', { name: 'Ya, hapus permanen' }).click();
    await expect(page.getByText(/dihapus permanen/)).toBeVisible();
    await d.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(d).toHaveCount(0);
    const ada = await api<{ id: number; namaPelanggan: string }[]>(
      page,
      `/pelanggan?cari=${encodeURIComponent(nama)}&status=SEMUA`,
    );
    expect(ada).toHaveLength(1);
    dibuat.push(ada[0]!.id);
  } finally {
    for (const id of dibuat)
      await api(page, `/pelanggan/${id}/status`, 'PATCH', { statusAktif: 'NONAKTIF' });
  }
});
