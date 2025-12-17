import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scrapingApi } from '../api/client';
import type { CreateRunParams } from '../types';

export function useScrapingRuns(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['scraping-runs', page, pageSize],
    queryFn: () => scrapingApi.getRuns(page, pageSize),
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
}

export function useScrapingRun(runId: number | null) {
  return useQuery({
    queryKey: ['scraping-run', runId],
    queryFn: () => scrapingApi.getRun(runId!),
    enabled: !!runId,
    refetchInterval: (data) => {
      // Auto-refresh if run is still in progress
      if (data?.status === 'running' || data?.status === 'pending') {
        return 3000;
      }
      return false;
    },
  });
}

export function useScrapingResults(runId: number | null, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['scraping-results', runId, page, pageSize],
    queryFn: () => scrapingApi.getResults(runId!, page, pageSize),
    enabled: !!runId,
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateRunParams) => scrapingApi.createRun(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraping-runs'] });
    },
  });
}

export function useAbortRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: number) => scrapingApi.abortRun(runId),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: ['scraping-runs'] });
      queryClient.invalidateQueries({ queryKey: ['scraping-run', runId] });
    },
  });
}

export function useFetchResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: number) => scrapingApi.fetchResults(runId),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: ['scraping-runs'] });
      queryClient.invalidateQueries({ queryKey: ['scraping-run', runId] });
      queryClient.invalidateQueries({ queryKey: ['scraping-results', runId] });
    },
  });
}
