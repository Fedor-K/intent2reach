'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Users,
  Send,
  MessageSquare,
  Loader2,
  RefreshCw,
  Download,
  Flame,
  ThermometerSun,
  ExternalLink,
  Check,
} from 'lucide-react'

interface Campaign {
  id: number
  name: string
  message1Template: string | null
  landingUrl: string | null
  invitesPerDay: number
  messagesPerDay: number
  isActive: boolean
}

interface CampaignLead {
  id: number
  profileUrl: string
  name: string
  firstName: string | null
  headline: string | null
  avatarUrl: string | null
  temperature: 'HOT' | 'WARM'
  status: 'NEW' | 'INVITED' | 'CONNECTED' | 'MSG1' | 'DONE'
  notes: string | null
  createdAt: string
  invitedAt: string | null
  connectedAt: string | null
  msg1At: string | null
}

interface ScrapingRun {
  id: number
  searchQueries: string[]
  status: string
  resultsCount: number
  createdAt: string
}

interface CampaignLeadsPanelProps {
  campaign: Campaign
  onBack: () => void
}

const STATUS_OPTIONS = ['NEW', 'INVITED', 'CONNECTED', 'MSG1', 'DONE'] as const
const TEMP_OPTIONS = ['HOT', 'WARM'] as const

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  INVITED: 'bg-blue-100 text-blue-700',
  CONNECTED: 'bg-green-100 text-green-700',
  MSG1: 'bg-purple-100 text-purple-700',
  DONE: 'bg-gray-200 text-gray-600',
}

export function CampaignLeadsPanel({ campaign, onBack }: CampaignLeadsPanelProps) {
  const [leads, setLeads] = useState<CampaignLead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [tempFilter, setTempFilter] = useState<string>('')

  // Import modal state
  const [showImport, setShowImport] = useState(false)
  const [runs, setRuns] = useState<ScrapingRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>('')
  const [importSource, setImportSource] = useState<'commenters' | 'reactors' | 'both'>('both')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  // Queue action state
  const [queueing, setQueueing] = useState(false)
  const [queueResult, setQueueResult] = useState<{ queued: number; message?: string } | null>(null)

  // Selected leads
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '50',
      })
      if (statusFilter) params.set('status', statusFilter)
      if (tempFilter) params.set('temperature', tempFilter)

      const res = await fetch(`/api/campaigns/${campaign.id}/leads?${params}`)
      const data = await res.json()
      setLeads(data.leads)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    } finally {
      setLoading(false)
    }
  }, [campaign.id, page, statusFilter, tempFilter])

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/scraping/runs?pageSize=20')
      const data = await res.json()
      setRuns(data.runs.filter((r: ScrapingRun) => r.status === 'SUCCEEDED' && r.resultsCount > 0))
    } catch (error) {
      console.error('Failed to fetch runs:', error)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  useEffect(() => {
    if (showImport) {
      fetchRuns()
    }
  }, [showImport, fetchRuns])

  const handleImport = async () => {
    if (!selectedRunId) return

    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: selectedRunId, source: importSource }),
      })
      const data = await res.json()
      setImportResult({ imported: data.imported, skipped: data.skipped })
      await fetchLeads()
    } catch (error) {
      console.error('Failed to import leads:', error)
    } finally {
      setImporting(false)
    }
  }

  const handleQueueAction = async (action: 'CONNECT' | 'MESSAGE1', hotFirst: boolean = true) => {
    setQueueing(true)
    setQueueResult(null)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/leads/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, hotFirst }),
      })
      const data = await res.json()
      if (res.ok) {
        setQueueResult({ queued: data.queued })
      } else {
        setQueueResult({ queued: 0, message: data.error })
      }
    } catch (error) {
      console.error('Failed to queue action:', error)
    } finally {
      setQueueing(false)
    }
  }

  const handleUpdateLead = async (leadId: number, updates: Partial<CampaignLead>) => {
    try {
      await fetch(`/api/campaigns/${campaign.id}/leads`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [leadId], updates }),
      })
      await fetchLeads()
    } catch (error) {
      console.error('Failed to update lead:', error)
    }
  }

  const handleBulkUpdate = async (updates: Partial<CampaignLead>) => {
    if (selectedIds.size === 0) return

    try {
      await fetch(`/api/campaigns/${campaign.id}/leads`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedIds), updates }),
      })
      setSelectedIds(new Set())
      await fetchLeads()
    } catch (error) {
      console.error('Failed to bulk update:', error)
    }
  }

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)))
    }
  }

  // Stats
  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{campaign.name}</h3>
          <p className="text-sm text-gray-500">
            {total} leads | {campaign.invitesPerDay} invites/day | {campaign.messagesPerDay} messages/day
          </p>
        </div>
        <button onClick={() => setShowImport(true)} className="btn btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" />
          Import Leads
        </button>
        <button onClick={fetchLeads} className="btn btn-secondary p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="card border-2 border-blue-200">
          <h4 className="font-medium mb-4">Import Leads from Scraping Run</h4>

          <div className="space-y-4">
            <div>
              <label className="label">Select Run</label>
              <select
                className="input"
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
              >
                <option value="">-- Select a run --</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    Run #{run.id} - {run.searchQueries.join(', ')} ({run.resultsCount} results)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Import From</label>
              <select
                className="input"
                value={importSource}
                onChange={(e) => setImportSource(e.target.value as typeof importSource)}
              >
                <option value="both">Commenters + Reactors</option>
                <option value="commenters">Commenters only</option>
                <option value="reactors">Reactors only</option>
              </select>
            </div>

            {importResult && (
              <div className="p-3 bg-green-50 text-green-700 rounded">
                Imported {importResult.imported} leads, skipped {importResult.skipped} duplicates
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={!selectedRunId || importing}
                className="btn btn-primary flex items-center gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Import
              </button>
              <button onClick={() => setShowImport(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mass Actions */}
      <div className="card">
        <h4 className="font-medium mb-3">Queue Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQueueAction('CONNECT', true)}
            disabled={queueing}
            className="btn btn-secondary flex items-center gap-2"
          >
            {queueing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Queue CONNECT (HOT first)
          </button>
          <button
            onClick={() => handleQueueAction('CONNECT', false)}
            disabled={queueing}
            className="btn btn-secondary flex items-center gap-2"
          >
            Queue CONNECT (all NEW)
          </button>
          <button
            onClick={() => handleQueueAction('MESSAGE1')}
            disabled={queueing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Queue MESSAGE1 (CONNECTED)
          </button>
        </div>
        {queueResult && (
          <p className={`text-sm mt-2 ${queueResult.queued > 0 ? 'text-green-600' : 'text-orange-600'}`}>
            {queueResult.message || `Queued ${queueResult.queued} actions`}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          className="input w-40"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} {statusCounts[s] ? `(${statusCounts[s]})` : ''}
            </option>
          ))}
        </select>

        <select
          className="input w-40"
          value={tempFilter}
          onChange={(e) => {
            setTempFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All Temps</option>
          <option value="HOT">HOT</option>
          <option value="WARM">WARM</option>
        </select>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
            <button
              onClick={() => handleBulkUpdate({ temperature: 'HOT' })}
              className="btn btn-secondary text-sm"
            >
              Mark HOT
            </button>
            <button
              onClick={() => handleBulkUpdate({ status: 'CONNECTED' })}
              className="btn btn-secondary text-sm"
            >
              Mark CONNECTED
            </button>
          </div>
        )}
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="card text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        </div>
      ) : leads.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No leads yet</p>
          <p className="text-sm text-gray-400">Import leads from a scraping run</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === leads.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Headline</th>
                <th className="pb-2">Temp</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  <td className="py-2">
                    <a
                      href={lead.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {lead.name}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="py-2 text-gray-500 max-w-xs truncate">{lead.headline || '-'}</td>
                  <td className="py-2">
                    <select
                      value={lead.temperature}
                      onChange={(e) =>
                        handleUpdateLead(lead.id, { temperature: e.target.value as 'HOT' | 'WARM' })
                      }
                      className={`text-xs px-2 py-1 rounded border-0 ${
                        lead.temperature === 'HOT' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      <option value="HOT">HOT</option>
                      <option value="WARM">WARM</option>
                    </select>
                  </td>
                  <td className="py-2">
                    <select
                      value={lead.status}
                      onChange={(e) =>
                        handleUpdateLead(lead.id, { status: e.target.value as CampaignLead['status'] })
                      }
                      className={`text-xs px-2 py-1 rounded border-0 ${STATUS_COLORS[lead.status]}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <input
                      type="text"
                      className="input text-xs py-1"
                      placeholder="Add note..."
                      defaultValue={lead.notes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (lead.notes || '')) {
                          handleUpdateLead(lead.id, { notes: e.target.value })
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                Page {page} of {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 50 >= total}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
