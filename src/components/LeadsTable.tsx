'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ExternalLink, User, Search, Download, Trash2, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { Lead } from '@/types'

interface LeadsResponse {
  leads: Lead[]
  total: number
  page: number
  pageSize: number
}

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [engagementFilter, setEngagementFilter] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      if (search) params.set('search', search)
      if (engagementFilter) params.set('engagementType', engagementFilter)

      const res = await fetch(`/api/leads?${params}`)
      const data: LeadsResponse = await res.json()
      setLeads(data.leads)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, engagementFilter])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const totalPages = Math.ceil(total / pageSize)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchLeads()
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
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)))
    }
  }

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} leads?`)) return

    try {
      await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      setSelectedIds(new Set())
      fetchLeads()
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const exportCSV = () => {
    const headers = ['Name', 'Position', 'LinkedIn URL', 'Engagement Types', 'First Seen', 'Last Seen']
    const rows = leads.map(lead => [
      lead.name,
      lead.position || '',
      lead.linkedinUrl,
      Array.from(new Set(lead.engagementTypes)).join(', '),
      format(new Date(lead.firstSeenAt), 'yyyy-MM-dd'),
      format(new Date(lead.lastSeenAt), 'yyyy-MM-dd'),
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const uniqueEngagementTypes = (types: string[]) => Array.from(new Set(types))

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Extract post ID from LinkedIn URL for display
  const getPostPreview = (url: string) => {
    // Try to get activity ID
    const activityMatch = url.match(/activity[:-](\d+)/)
    if (activityMatch) return `Post #${activityMatch[1].slice(-6)}`

    const urnMatch = url.match(/urn:li:activity:(\d+)/)
    if (urnMatch) return `Post #${urnMatch[1].slice(-6)}`

    return url.slice(0, 50) + '...'
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
                placeholder="Name or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div>
            <label className="label">Engagement Type</label>
            <select
              className="input"
              value={engagementFilter}
              onChange={(e) => {
                setEngagementFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All</option>
              <option value="LIKE">Likes</option>
              <option value="COMMENT">Comments</option>
              <option value="EMPATHY">Empathy</option>
              <option value="PRAISE">Praise</option>
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
        {total} leads total
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No leads found. Run a scraping job with reactions/comments enabled to collect leads.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-3 text-left w-8"></th>
                  <th className="px-2 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === leads.length && leads.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Person
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engagement
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Posts
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profile
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map((lead) => {
                  const isExpanded = expandedIds.has(lead.id)
                  const hasSourcePosts = lead.sourcePostUrls && lead.sourcePostUrls.length > 0

                  return (
                    <React.Fragment key={lead.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-2 py-3">
                          {hasSourcePosts && (
                            <button
                              onClick={() => toggleExpand(lead.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            {lead.avatarUrl ? (
                              <img
                                src={lead.avatarUrl}
                                alt={lead.name}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900">
                                {lead.name}
                              </div>
                              {lead.position && (
                                <div className="text-gray-500 text-sm truncate max-w-[300px]">
                                  {lead.position}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {uniqueEngagementTypes(lead.engagementTypes).map((type, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 text-xs rounded ${
                                  type === 'COMMENT'
                                    ? 'bg-green-100 text-green-700'
                                    : type === 'EMPATHY'
                                    ? 'bg-purple-100 text-purple-700'
                                    : type === 'PRAISE'
                                    ? 'bg-orange-100 text-orange-700'
                                    : type === 'APPRECIATION'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {type}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {lead.sourcePostUrls?.length || 0} posts
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {format(new Date(lead.lastSeenAt), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={lead.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Profile
                          </a>
                        </td>
                      </tr>

                      {/* Expanded row showing source posts */}
                      {isExpanded && hasSourcePosts && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="pl-10">
                              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Posts this person engaged with:
                              </h4>
                              <div className="space-y-2">
                                {lead.sourcePostUrls.map((url, idx) => (
                                  <div key={idx} className="flex items-center gap-3 text-sm">
                                    <span className="text-gray-400">{idx + 1}.</span>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      {getPostPreview(url)}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
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
