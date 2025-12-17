import { useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import type { CreateRunParams } from '../types';

interface CreateRunFormProps {
  onSubmit: (params: CreateRunParams) => void;
  isLoading: boolean;
}

export function CreateRunForm({ onSubmit, isLoading }: CreateRunFormProps) {
  const [searchQueries, setSearchQueries] = useState('');
  const [authorUrls, setAuthorUrls] = useState('');
  const [authorsCompanies, setAuthorsCompanies] = useState('');
  const [postedLimit, setPostedLimit] = useState('24h');
  const [maxPosts, setMaxPosts] = useState(100);
  const [scrapeComments, setScrapeComments] = useState(true);
  const [scrapeReactions, setScrapeReactions] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params: CreateRunParams = {
      posted_limit: postedLimit,
      max_posts: maxPosts,
      scrape_comments: scrapeComments,
      scrape_reactions: scrapeReactions,
    };

    if (searchQueries.trim()) {
      params.search_queries = searchQueries.split('\n').map(q => q.trim()).filter(Boolean);
    }
    if (authorUrls.trim()) {
      params.author_urls = authorUrls.split('\n').map(u => u.trim()).filter(Boolean);
    }
    if (authorsCompanies.trim()) {
      params.authors_companies = authorsCompanies.split('\n').map(c => c.trim()).filter(Boolean);
    }

    onSubmit(params);
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">New Scraping Run</h2>

      <div>
        <label className="label">Search Queries (one per line)</label>
        <textarea
          className="input min-h-[80px]"
          value={searchQueries}
          onChange={(e) => setSearchQueries(e.target.value)}
          placeholder="Enter search queries..."
        />
      </div>

      <div>
        <label className="label">Author URLs (one per line)</label>
        <textarea
          className="input min-h-[80px]"
          value={authorUrls}
          onChange={(e) => setAuthorUrls(e.target.value)}
          placeholder="https://linkedin.com/in/username"
        />
      </div>

      <div>
        <label className="label">Companies (one per line)</label>
        <textarea
          className="input min-h-[60px]"
          value={authorsCompanies}
          onChange={(e) => setAuthorsCompanies(e.target.value)}
          placeholder="Company names..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Posted Within</label>
          <select
            className="input"
            value={postedLimit}
            onChange={(e) => setPostedLimit(e.target.value)}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="365d">Last year</option>
          </select>
        </div>

        <div>
          <label className="label">Max Posts</label>
          <input
            type="number"
            className="input"
            value={maxPosts}
            onChange={(e) => setMaxPosts(parseInt(e.target.value) || 100)}
            min={1}
            max={50000}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={scrapeComments}
            onChange={(e) => setScrapeComments(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Scrape comments</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={scrapeReactions}
            onChange={(e) => setScrapeReactions(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Scrape reactions</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn btn-primary w-full flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Start Scraping
          </>
        )}
      </button>
    </form>
  );
}
