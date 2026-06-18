import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const RATES_STALE_TIME_MS = 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      gcTime: RATES_STALE_TIME_MS,
    },
  },
});

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'airsoft-celni-kalkulacka-cache',
});
