import { QueryClient } from '@tanstack/react-query';

export const RATES_STALE_TIME_MS = 60 * 60 * 1000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        gcTime: RATES_STALE_TIME_MS,
      },
    },
  });
}
