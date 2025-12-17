export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'aborted';

export interface ScrapingRun {
  id: number;
  apify_run_id: string | null;
  status: RunStatus;
  search_queries: string[] | null;
  author_urls: string[] | null;
  authors_companies: string[] | null;
  posted_limit: string;
  max_posts: number;
  max_comments: number;
  max_reactions: number;
  scrape_comments: number;
  scrape_reactions: number;
  scrape_pages: number;
  sort_by: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  results_count: number;
}

export interface ScrapingResult {
  id: number;
  run_id: number;
  post_url: string | null;
  post_id: string | null;
  post_text: string | null;
  post_date: string | null;
  author_name: string | null;
  author_url: string | null;
  author_headline: string | null;
  author_company: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

export interface ScrapingRunListResponse {
  runs: ScrapingRun[];
  total: number;
  page: number;
  page_size: number;
}

export interface ScrapingResultListResponse {
  results: ScrapingResult[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateRunParams {
  search_queries?: string[];
  author_urls?: string[];
  authors_companies?: string[];
  posted_limit?: string;
  max_posts?: number;
  max_comments?: number;
  max_reactions?: number;
  scrape_comments?: boolean;
  scrape_reactions?: boolean;
  scrape_pages?: number;
  sort_by?: string;
}
