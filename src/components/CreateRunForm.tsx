'use client'

import { useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { CreateRunRequest } from '@/types'

interface CreateRunFormProps {
  onSubmit: (params: CreateRunRequest) => Promise<void>
  isLoading: boolean
}

export function CreateRunForm({ onSubmit, isLoading }: CreateRunFormProps) {
  const [searchQueries, setSearchQueries] = useState('')
  const [authorUrls, setAuthorUrls] = useState('')
  const [authorsCompanies, setAuthorsCompanies] = useState('')
  const [postedLimit, setPostedLimit] = useState('24h')
  const [maxPostsInput, setMaxPostsInput] = useState('100')
  const [scrapeComments, setScrapeComments] = useState(true)
  const [scrapeReactions, setScrapeReactions] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const maxPosts = parseInt(maxPostsInput) || 100

    const params: CreateRunRequest = {
      postedLimit,
      maxPosts,
      scrapeComments,
      scrapeReactions,
    }

    // Collect all LinkedIn URLs (profiles and companies) into authorUrls
    const urls: string[] = []
    const companyNames: string[] = []

    if (authorUrls.trim()) {
      urls.push(...authorUrls.split('\n').map(u => u.trim()).filter(Boolean))
    }

    // Check if companies field contains URLs or names
    if (authorsCompanies.trim()) {
      authorsCompanies.split('\n').map(c => c.trim()).filter(Boolean).forEach(item => {
        if (item.includes('linkedin.com')) {
          // It's a URL - add to authorUrls
          urls.push(item)
        } else {
          // It's a company name
          companyNames.push(item)
        }
      })
    }

    if (searchQueries.trim()) {
      params.searchQueries = searchQueries.split('\n').map(q => q.trim()).filter(Boolean)
    }
    if (urls.length > 0) {
      params.authorUrls = urls
    }
    if (companyNames.length > 0) {
      params.authorsCompanies = companyNames
    }

    await onSubmit(params)
  }

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
        <label className="label">LinkedIn URLs - profiles or companies (one per line)</label>
        <textarea
          className="input min-h-[80px]"
          value={authorUrls}
          onChange={(e) => setAuthorUrls(e.target.value)}
          placeholder="https://linkedin.com/in/username&#10;https://linkedin.com/company/12345/"
        />
      </div>

      <div>
        <label className="label">Filter by company name (one per line)</label>
        <textarea
          className="input min-h-[60px]"
          value={authorsCompanies}
          onChange={(e) => setAuthorsCompanies(e.target.value)}
          placeholder="Google, Microsoft..."
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
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="3months">Last 3 months</option>
            <option value="6months">Last 6 months</option>
            <option value="year">Last year</option>
            <option value="any">Any time</option>
          </select>
        </div>

        <div>
          <label className="label">Max Posts</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="input"
            value={maxPostsInput}
            onChange={(e) => setMaxPostsInput(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="100"
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
  )
}
