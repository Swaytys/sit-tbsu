import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ambilData, api, paramId } from './client';

export type JenisMaster = 'pelanggan' | 'pemasok' | 'barang';

/** K-199: hapus permanen data master ganda yang belum pernah dipakai (API menolak bila sudah dipakai). */
export function useHapusMaster(jenis: JenisMaster) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const param = paramId(id);
      if (jenis === 'pelanggan') return ambilData(await api.pelanggan[':id'].$delete({ param }));
      if (jenis === 'pemasok') return ambilData(await api.pemasok[':id'].$delete({ param }));
      return ambilData(await api.barang[':id'].$delete({ param }));
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}
