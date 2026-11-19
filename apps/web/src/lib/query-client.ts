import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api-client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached lists while offline and refetch when the connection returns.
        networkMode: 'offlineFirst',
        staleTime: 30_000,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
      mutations: { networkMode: 'offlineFirst' },
    },
  });
}
