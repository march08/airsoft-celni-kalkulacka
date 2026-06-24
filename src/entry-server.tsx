import { renderToString } from 'react-dom/server';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import App from './App';
import { FALLBACK_RATES, fetchExchangeRates } from './api/exchangeRates';
import { RATES_STALE_TIME_MS } from './queryClient';

export async function render() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        gcTime: RATES_STALE_TIME_MS,
      },
    },
  });

  try {
    await queryClient.prefetchQuery({
      queryKey: ['exchangeRates'],
      queryFn: fetchExchangeRates,
      staleTime: RATES_STALE_TIME_MS,
      gcTime: RATES_STALE_TIME_MS,
    });
  } catch {
    queryClient.setQueryData(['exchangeRates'], FALLBACK_RATES);
  }

  const dehydratedState = dehydrate(queryClient);

  const appHtml = renderToString(
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <App />
      </HydrationBoundary>
    </QueryClientProvider>
  );

  queryClient.clear();

  return { appHtml, dehydratedState };
}
