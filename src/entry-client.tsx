import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { HydrationBoundary } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import App from './App';
import { createQueryClient, RATES_STALE_TIME_MS } from './queryClient';
import './index.css';

const queryClient = createQueryClient();
const dehydratedState = window.__REACT_QUERY_STATE__;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const app = (
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: createSyncStoragePersister({
          storage: window.localStorage,
          key: 'airsoft-celni-kalkulacka-cache',
        }),
        maxAge: RATES_STALE_TIME_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && query.queryKey[0] === 'exchangeRates',
        },
      }}
    >
      <HydrationBoundary state={dehydratedState}>
        <App />
      </HydrationBoundary>
    </PersistQueryClientProvider>
  </StrictMode>
);

const hasPrerenderedMarkup = Array.from(rootElement.childNodes).some(
  (node) => node.nodeType === Node.ELEMENT_NODE
);

if (hasPrerenderedMarkup) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
