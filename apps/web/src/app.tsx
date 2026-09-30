import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { kunciAuth } from '@/api/auth';
import { GalatApi } from '@/api/client';
import { Toaster } from '@/components/ui/sonner';
import { router } from './routes';

/**
 * Bila server menjawab 401 (sesi berakhir) atau WAJIB_GANTI_PASSWORD saat pengguna dianggap login,
 * muat ulang data "saya"; penjaga rute lalu mengarahkan ke halaman login / ganti password.
 */
function periksaSesi(err: unknown) {
  const sesiBerubah =
    err instanceof GalatApi && (err.status === 401 || err.kode === 'WAJIB_GANTI_PASSWORD');
  if (sesiBerubah && queryClient.getQueryData(kunciAuth.saya)) {
    void queryClient.invalidateQueries({ queryKey: kunciAuth.saya });
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: periksaSesi }),
  mutationCache: new MutationCache({ onError: periksaSesi }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
