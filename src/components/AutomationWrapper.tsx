'use client'

import React, { useState } from 'react'
import { Bot, Users, Settings } from 'lucide-react'
import { AutomationPanel } from './AutomationPanel'
import { CampaignsPanel } from './CampaignsPanel'
import { CampaignLeadsPanel } from './CampaignLeadsPanel'

type SubTab = 'browser' | 'campaigns'

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

export function AutomationWrapper() {
  const [subTab, setSubTab] = useState<SubTab>('campaigns')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)

  // If viewing a campaign's leads
  if (selectedCampaign) {
    return (
      <CampaignLeadsPanel
        campaign={selectedCampaign}
        onBack={() => setSelectedCampaign(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setSubTab('campaigns')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'campaigns'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Campaigns
          </div>
        </button>
        <button
          onClick={() => setSubTab('browser')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'browser'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Browser & Queue
          </div>
        </button>
      </div>

      {/* Content */}
      {subTab === 'campaigns' ? (
        <CampaignsPanel onSelectCampaign={setSelectedCampaign} />
      ) : (
        <AutomationPanel />
      )}
    </div>
  )
}
