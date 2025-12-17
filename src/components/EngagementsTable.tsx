'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, User, Search, Download, Trash2, MessageSquare, ThumbsUp, Heart, Sparkles } from 'lucide-react'
import { Engagement } from '@/types'

interface EngagementsResponse {
  engagements: Engagement[]
  total: number
  page: number
  pageSize: number
}

const ENGAGEMENT_ICONS: Record<string, React.ReactNode> = {
  LIKE: <ThumbsUp className="w-4 h-4 text-blue-500" />,
  COMMENT: <MessageSquare className="w-4 h-4 text-green-500" />,
  EMPATHY: <Heart className="w-4 h-4 text-purple-500" />,
  PRAISE: <Sparkles className="w-4 h-4 text-orange-500" />,
  APPRECIATION: <Sparkles className="w-4 h-4 text-yellow-500" />,
}

const ENGAGEMENT_LABELS: Record<string, string> = {
  LIKE: 'liked',
  COMMENT: 'commented on',
  EMPATHY: 'reacted with empathy to',
  PRAISE: 'praised',
  APPRECIATION: 'appreciated',
}

export function EngagementsTable() {
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [engagementFilter, setEngagementFilter] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const fetchEngagements = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      if (search) params.set('search', search)
      if (engagementFilter) params.set('engagementType', engagementFilter)

      const res = await fetch(`/api/engagements?${params}`)
      const data: EngagementsResponse = await res.json()
      setEngagements(data.engagements)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch engagements:', error)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, engagementFilter])

  useEffect(() => {
    fetchEngagements()
  }, [fetchEngagements])

  const totalPages = Math.ceil(total / pageSize)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchEngagements()
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === engagements.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(engagements.map(e => e.id)))
    }
  }

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} engagements?`)) return

    try {
      await fetch('/api/engagements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      setSelectedIds(new Set())
      fetchEngagements()
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const exportCSV = () => {
    const headers = ['Name', 'Position', 'LinkedIn', 'Action', 'Post URL', 'Comment', 'When']
    const rows = engagements.map(e => [
      e.personName,
      e.personPosition || '',
      e.personLinkedinUrl,
      e.engagementType,
      e.postUrl,
      e.commentText || '',
      e.createdAt,
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `engagements-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getTimeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return ''
    }
  }

  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return ''
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <label className="label">Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Name, position, post author, keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div>
            <label className="label">Action Type</label>
            <select
              className="input"
              value={engagementFilter}
              onChange={(e) => {
                setEngagementFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All</option>
              <option value="COMMENT">Comments</option>
              <option value="LIKE">Likes</option>
              <option value="EMPATHY">Empathy</option>
              <option value="PRAISE">Praise</option>
              <option value="APPRECIATION">Appreciation</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={exportCSV} className="btn btn-secondary flex items-center gap-1">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            {selectedIds.size > 0 && (
              <button onClick={deleteSelected} className="btn btn-secondary text-red-600 flex items-center gap-1">
                <Trash2 className="w-4 h-4" />
                Delete ({selectedIds.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-600">
        {total} engagements total
      </div>

      {/* Activity Feed */}
      <div className="card p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : engagements.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No engagements found. Run a scraping job with reactions/comments enabled.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {engagements.map((engagement) => (
              <div key={engagement.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(engagement.id)}
                      onChange={() => toggleSelect(engagement.id)}
                      className="rounded border-gray-300"
                    />
                  </div>

                  {/* Avatar */}
                  {engagement.personAvatarUrl ? (
                    <img
                      src={engagement.personAvatarUrl}
                      alt={engagement.personName}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Person info & action */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <a
                            href={engagement.personLinkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {engagement.personName}
                          </a>
                          <span className="text-blue-500 text-sm">in</span>
                        </div>
                        {engagement.personPosition && (
                          <p className="text-sm text-gray-500 truncate max-w-md">
                            {engagement.personPosition}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-gray-400 whitespace-nowrap">
                        {getTimeAgo(engagement.createdAt)}
                      </span>
                    </div>

                    {/* Engagement action */}
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      {ENGAGEMENT_ICONS[engagement.engagementType] || <ThumbsUp className="w-4 h-4 text-gray-400" />}
                      <span className="text-gray-600">
                        {ENGAGEMENT_LABELS[engagement.engagementType] || 'engaged with'}
                      </span>
                      <a
                        href={engagement.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        a LinkedIn post
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {engagement.searchQuery && (
                        <span className="text-gray-400">
                          • Keyword: "{engagement.searchQuery}"
                        </span>
                      )}
                    </div>

                    {/* Post preview */}
                    {engagement.postText && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 border-l-4 border-gray-200">
                        {truncateText(engagement.postText, 150)}
                        {engagement.postAuthorName && (
                          <span className="text-gray-400 ml-2">
                            — {engagement.postAuthorName}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Comment text */}
                    {engagement.engagementType === 'COMMENT' && engagement.commentText && (
                      <div className="mt-2 p-3 bg-green-50 rounded-lg text-sm text-gray-700 border-l-4 border-green-400">
                        <span className="text-green-600 font-medium">Comment:</span> {engagement.commentText}
                      </div>
                    )}
                  </div>

                  {/* Quick action - Link to profile */}
                  <a
                    href={engagement.personLinkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary text-sm whitespace-nowrap"
                  >
                    View Profile
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="flex items-center px-3 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
