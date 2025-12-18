'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  ChevronRight,
  Users,
  Send,
  MessageSquare,
  Loader2,
  Trash2,
  Settings,
  Play,
  Pause,
} from 'lucide-react'

interface Campaign {
  id: number
  name: string
  message1Template: string | null
  landingUrl: string | null
  invitesPerDay: number
  messagesPerDay: number
  workingHoursStart: number
  workingHoursEnd: number
  isActive: boolean
  pausedReason: string | null
  totalLeads: number
  invitedCount: number
  connectedCount: number
  messagedCount: number
  createdAt: string
  _count?: { leads: number }
}

interface CampaignsPanelProps {
  onSelectCampaign: (campaign: Campaign) => void
}

export function CampaignsPanel({ onSelectCampaign }: CampaignsPanelProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [message1Template, setMessage1Template] = useState('')
  const [landingUrl, setLandingUrl] = useState('')
  const [invitesPerDay, setInvitesPerDay] = useState(20)
  const [messagesPerDay, setMessagesPerDay] = useState(50)

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns')
      const data = await res.json()
      setCampaigns(data)
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          message1Template: message1Template || null,
          landingUrl: landingUrl || null,
          invitesPerDay,
          messagesPerDay,
        }),
      })

      if (res.ok) {
        await fetchCampaigns()
        setShowCreate(false)
        setName('')
        setMessage1Template('')
        setLandingUrl('')
      }
    } catch (error) {
      console.error('Failed to create campaign:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (campaignId: number) => {
    if (!confirm('Delete this campaign and all its leads?')) return

    try {
      await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' })
      await fetchCampaigns()
    } catch (error) {
      console.error('Failed to delete campaign:', error)
    }
  }

  const handleToggleActive = async (campaign: Campaign) => {
    try {
      await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !campaign.isActive }),
      })
      await fetchCampaigns()
    } catch (error) {
      console.error('Failed to toggle campaign:', error)
    }
  }

  if (loading) {
    return (
      <div className="card text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        <p className="mt-2 text-gray-500">Loading campaigns...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Outreach Campaigns</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card">
          <h4 className="font-medium mb-4">Create New Campaign</h4>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Campaign Name</label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Copywriter Outreach Q1"
                required
              />
            </div>

            <div>
              <label className="label">Message Template</label>
              <textarea
                className="input min-h-[100px]"
                value={message1Template}
                onChange={(e) => setMessage1Template(e.target.value)}
                placeholder="Hi {{firstName}}, I saw your profile..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Variables: {'{{firstName}}'}, {'{{landingUrl}}'}
              </p>
            </div>

            <div>
              <label className="label">Landing URL (optional)</label>
              <input
                type="url"
                className="input"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                placeholder="https://yoursite.com/jobs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Invites/Day</label>
                <input
                  type="number"
                  className="input"
                  value={invitesPerDay}
                  onChange={(e) => setInvitesPerDay(parseInt(e.target.value) || 20)}
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <label className="label">Messages/Day</label>
                <input
                  type="number"
                  className="input"
                  value={messagesPerDay}
                  onChange={(e) => setMessagesPerDay(parseInt(e.target.value) || 50)}
                  min={1}
                  max={200}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="btn btn-primary flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Campaign
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No campaigns yet</p>
          <p className="text-sm text-gray-400">Create your first outreach campaign</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelectCampaign(campaign)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">{campaign.name}</h4>
                    {campaign.isActive ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        Paused
                      </span>
                    )}
                    {campaign.pausedReason && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                        {campaign.pausedReason}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {campaign._count?.leads || campaign.totalLeads} leads
                    </div>
                    <div className="flex items-center gap-1">
                      <Send className="w-4 h-4" />
                      {campaign.invitedCount} invited
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {campaign.messagedCount} messaged
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleActive(campaign)}
                    className="p-2 hover:bg-gray-100 rounded"
                    title={campaign.isActive ? 'Pause' : 'Resume'}
                  >
                    {campaign.isActive ? (
                      <Pause className="w-4 h-4 text-orange-500" />
                    ) : (
                      <Play className="w-4 h-4 text-green-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
