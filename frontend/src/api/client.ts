import axios from 'axios';
import type {
  ScrapingRun,
  ScrapingRunListResponse,
  ScrapingResultListResponse,
  CreateRunParams,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const scrapingApi = {
  // Create a new scraping run
  createRun: async (params: CreateRunParams): Promise<ScrapingRun> => {
    const { data } = await api.post<ScrapingRun>('/scraping/runs', params);
    return data;
  },

  // Get list of runs
  getRuns: async (page = 1, pageSize = 20): Promise<ScrapingRunListResponse> => {
    const { data } = await api.get<ScrapingRunListResponse>('/scraping/runs', {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  // Get single run
  getRun: async (runId: number): Promise<ScrapingRun> => {
    const { data } = await api.get<ScrapingRun>(`/scraping/runs/${runId}`);
    return data;
  },

  // Check run status
  checkStatus: async (runId: number): Promise<ScrapingRun> => {
    const { data } = await api.get<ScrapingRun>(`/scraping/runs/${runId}/status`);
    return data;
  },

  // Fetch results for a run
  fetchResults: async (runId: number): Promise<ScrapingRun> => {
    const { data } = await api.post<ScrapingRun>(`/scraping/runs/${runId}/fetch-results`);
    return data;
  },

  // Abort a running scrape
  abortRun: async (runId: number): Promise<ScrapingRun> => {
    const { data } = await api.post<ScrapingRun>(`/scraping/runs/${runId}/abort`);
    return data;
  },

  // Get results for a run
  getResults: async (
    runId: number,
    page = 1,
    pageSize = 50
  ): Promise<ScrapingResultListResponse> => {
    const { data } = await api.get<ScrapingResultListResponse>(
      `/scraping/runs/${runId}/results`,
      { params: { page, page_size: pageSize } }
    );
    return data;
  },
};

export default api;
