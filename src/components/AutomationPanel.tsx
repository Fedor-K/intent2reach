'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Play,
  Square,
  Pause,
  PlayCircle,
  Settings,
  Clock,
  ThumbsUp,
  UserPlus,
  MessageSquare,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  RefreshCw,
} from 'lucide-react'

interface BrowserState {
  isRunning: boolean
  isLoggedIn: boolean
  isPaused: boolean
  linkedinName: string | null
  linkedinUrl: string | null
  lastCheckedAt: string | null
  error: string | null
}

interface SessionResponse {
  browser: BrowserState
  todayStats: {
    likesCount: number
    connectsCount: number
    messagesCount: number
    commentsCount: number
    totalCount: number
  }
  queueStats: {
    pending: number
    completed: number
    failed: number
  }
}

interface QueueAction {
  id: number
  actionType: string
  status: string
  targetUrl: string
  targetName: string | null
  messageText: string | null
  attempts: number
  errorMessage: string | null
  createdAt: string
}

interface AutomationSettings {
  id: number
  dailyLikeLimit: number
  dailyConnectLimit: number
  dailyMessageLimit: number
  dailyCommentLimit: number
  dailyTotalLimit: number
  minDelayBetweenActions: number
  maxDelayBetweenActions: number
  workingHoursStart: number
  workingHoursEnd: number
  enableRandomPauses: boolean
  pauseMinMinutes: number
  pauseMaxMinutes: number
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  LIKE: <ThumbsUp className="w-4 h-4 text-blue-500" />,
  CONNECT: <UserPlus className="w-4 h-4 text-green-500" />,
  CONNECT_NO_NOTE: <UserPlus className="w-4 h-4 text-green-600" />,
  MESSAGE: <MessageSquare className="w-4 h-4 text-purple-500" />,
  MESSAGE1: <MessageSquare className="w-4 h-4 text-purple-600" />,
  COMMENT: <MessageCircle className="w-4 h-4 text-orange-500" />,
  PROFILE_VIEW: <Settings className="w-4 h-4 text-gray-500" />,
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

export function AutomationPanel() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [queue, setQueue] = useState<QueueAction[]>([])
  const [queueTotal, setQueueTotal] = useState(0)
  const [settings, setSettings] = useState<AutomationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [queueFilter, setQueueFilter] = useState('')

  // Fetch session status
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/session')
      const data: SessionResponse = await res.json()
      setSession(data)
    } catch (error) {
      console.error('Failed to fetch session:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch queue
  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams({ pageSize: '10' })
      if (queueFilter) params.set('status', queueFilter)
      const res = await fetch(`/api/automation/queue?${params}`)
      const data = await res.json()
      setQueue(data.actions)
      setQueueTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
  }, [queueFilter])

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/settings')
      const data: AutomationSettings = await res.json()
      setSettings(data)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }, [])

  // Initial load and auto-refresh
  useEffect(() => {
    fetchSession()
    fetchQueue()
    fetchSettings()

    const interval = setInterval(() => {
      fetchSession()
      fetchQueue()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchSession, fetchQueue, fetchSettings])

  // Refetch queue when filter changes
  useEffect(() => {
    fetchQueue()
  }, [queueFilter, fetchQueue])

  // Session actions
  const handleSessionAction = async (action: string) => {
    setActionLoading(true)
    try {
      await fetch('/api/automation/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await fetchSession()
    } catch (error) {
      console.error('Session action failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  // Update settings
  const handleUpdateSettings = async (updates: Partial<AutomationSettings>) => {
    try {
      const res = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      setSettings(data)
    } catch (error) {
      console.error('Failed to update settings:', error)
    }
  }

  // Clear queue
  const handleClearQueue = async (type: 'completed' | 'failed') => {
    try {
      await fetch('/api/automation/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'completed' ? { clearCompleted: true } : { clearFailed: true }),
      })
      fetchQueue()
    } catch (error) {
      console.error('Failed to clear queue:', error)
    }
  }

  if (loading) {
    return (
      <div className="card text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        <p className="mt-2 text-gray-500">Loading automation status...</p>
      </div>
    )
  }

  const browser = session?.browser
  const todayStats = session?.todayStats
  const queueStats = session?.queueStats

  return (
    <div className="space-y-6">
      {/* Browser Control */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Browser Status</h3>

        {/* Instructions */}
        {!browser?.isRunning && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg text-sm">
            <p className="font-medium text-blue-900 mb-2">How to start automation:</p>
            <ol className="list-decimal list-inside text-blue-800 space-y-1">
              <li>Open a terminal on the server</li>
              <li>Run: <code className="bg-blue-100 px-1 rounded">npx ts-node scripts/automation.ts</code></li>
              <li>Log in to LinkedIn in the browser window that opens</li>
              <li>The script will start processing the action queue automatically</li>
            </ol>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            browser?.isRunning
              ? browser?.isLoggedIn
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {browser?.isRunning ? (
              browser?.isLoggedIn ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Logged in{browser.linkedinName ? ` as ${browser.linkedinName}` : ''}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5" />
                  <span>Browser open - Please log in to LinkedIn</span>
                </>
              )
            ) : (
              <>
                <Square className="w-5 h-5" />
                <span>Browser stopped</span>
              </>
            )}
          </div>

          {browser?.isPaused && (
            <span className="px-3 py-2 rounded-lg bg-orange-100 text-orange-800">
              Automation paused
            </span>
          )}
        </div>

        {/* Error */}
        {browser?.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
            {browser.error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {browser?.isRunning && browser?.isLoggedIn && (
            browser?.isPaused ? (
              <button
                onClick={() => handleSessionAction('resume')}
                disabled={actionLoading}
                className="btn btn-primary flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                Resume Automation
              </button>
            ) : (
              <button
                onClick={() => handleSessionAction('pause')}
                disabled={actionLoading}
                className="btn btn-secondary flex items-center gap-2 text-orange-600"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                Pause Automation
              </button>
            )
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn btn-secondary flex items-center gap-2 ml-auto"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && settings && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Automation Settings</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Daily Limits */}
            <div>
              <label className="label">Daily Like Limit</label>
              <input
                type="number"
                className="input"
                value={settings.dailyLikeLimit}
                onChange={(e) => handleUpdateSettings({ dailyLikeLimit: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Daily Connect Limit</label>
              <input
                type="number"
                className="input"
                value={settings.dailyConnectLimit}
                onChange={(e) => handleUpdateSettings({ dailyConnectLimit: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Daily Message Limit</label>
              <input
                type="number"
                className="input"
                value={settings.dailyMessageLimit}
                onChange={(e) => handleUpdateSettings({ dailyMessageLimit: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Daily Comment Limit</label>
              <input
                type="number"
                className="input"
                value={settings.dailyCommentLimit}
                onChange={(e) => handleUpdateSettings({ dailyCommentLimit: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Daily Total Limit</label>
              <input
                type="number"
                className="input"
                value={settings.dailyTotalLimit}
                onChange={(e) => handleUpdateSettings({ dailyTotalLimit: parseInt(e.target.value) })}
              />
            </div>

            {/* Delays */}
            <div>
              <label className="label">Min Delay (seconds)</label>
              <input
                type="number"
                className="input"
                value={settings.minDelayBetweenActions}
                onChange={(e) => handleUpdateSettings({ minDelayBetweenActions: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Max Delay (seconds)</label>
              <input
                type="number"
                className="input"
                value={settings.maxDelayBetweenActions}
                onChange={(e) => handleUpdateSettings({ maxDelayBetweenActions: parseInt(e.target.value) })}
              />
            </div>

            {/* Working Hours */}
            <div>
              <label className="label">Working Hours Start</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input w-20"
                  min="1"
                  max="12"
                  value={settings.workingHoursStart === 0 ? 12 : settings.workingHoursStart > 12 ? settings.workingHoursStart - 12 : settings.workingHoursStart}
                  onChange={(e) => {
                    const hour12 = parseInt(e.target.value) || 1
                    const isPM = settings.workingHoursStart >= 12
                    let hour24 = hour12
                    if (isPM) {
                      hour24 = hour12 === 12 ? 12 : hour12 + 12
                    } else {
                      hour24 = hour12 === 12 ? 0 : hour12
                    }
                    handleUpdateSettings({ workingHoursStart: hour24 })
                  }}
                />
                <select
                  className="input w-20"
                  value={settings.workingHoursStart >= 12 ? 'PM' : 'AM'}
                  onChange={(e) => {
                    const isPM = e.target.value === 'PM'
                    const currentHour = settings.workingHoursStart
                    const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour === 12 ? 12 : currentHour
                    let hour24 = hour12
                    if (isPM) {
                      hour24 = hour12 === 12 ? 12 : hour12 + 12
                    } else {
                      hour24 = hour12 === 12 ? 0 : hour12
                    }
                    handleUpdateSettings({ workingHoursStart: hour24 })
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Working Hours End</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input w-20"
                  min="1"
                  max="12"
                  value={settings.workingHoursEnd === 0 ? 12 : settings.workingHoursEnd > 12 ? settings.workingHoursEnd - 12 : settings.workingHoursEnd}
                  onChange={(e) => {
                    const hour12 = parseInt(e.target.value) || 1
                    const isPM = settings.workingHoursEnd >= 12
                    let hour24 = hour12
                    if (isPM) {
                      hour24 = hour12 === 12 ? 12 : hour12 + 12
                    } else {
                      hour24 = hour12 === 12 ? 0 : hour12
                    }
                    handleUpdateSettings({ workingHoursEnd: hour24 })
                  }}
                />
                <select
                  className="input w-20"
                  value={settings.workingHoursEnd >= 12 ? 'PM' : 'AM'}
                  onChange={(e) => {
                    const isPM = e.target.value === 'PM'
                    const currentHour = settings.workingHoursEnd
                    const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour === 12 ? 12 : currentHour
                    let hour24 = hour12
                    if (isPM) {
                      hour24 = hour12 === 12 ? 12 : hour12 + 12
                    } else {
                      hour24 = hour12 === 12 ? 0 : hour12
                    }
                    handleUpdateSettings({ workingHoursEnd: hour24 })
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            {/* Random Pauses */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enableRandomPauses"
                checked={settings.enableRandomPauses}
                onChange={(e) => handleUpdateSettings({ enableRandomPauses: e.target.checked })}
              />
              <label htmlFor="enableRandomPauses">Enable random pauses</label>
            </div>
          </div>
        </div>
      )}

      {/* Today's Stats */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Today's Activity</h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <ThumbsUp className="w-6 h-6 mx-auto text-blue-500" />
            <div className="text-2xl font-bold text-blue-700">{todayStats?.likesCount || 0}</div>
            <div className="text-sm text-gray-600">Likes</div>
            {settings && (
              <div className="text-xs text-gray-400">/ {settings.dailyLikeLimit}</div>
            )}
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <UserPlus className="w-6 h-6 mx-auto text-green-500" />
            <div className="text-2xl font-bold text-green-700">{todayStats?.connectsCount || 0}</div>
            <div className="text-sm text-gray-600">Connects</div>
            {settings && (
              <div className="text-xs text-gray-400">/ {settings.dailyConnectLimit}</div>
            )}
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <MessageSquare className="w-6 h-6 mx-auto text-purple-500" />
            <div className="text-2xl font-bold text-purple-700">{todayStats?.messagesCount || 0}</div>
            <div className="text-sm text-gray-600">Messages</div>
            {settings && (
              <div className="text-xs text-gray-400">/ {settings.dailyMessageLimit}</div>
            )}
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <MessageCircle className="w-6 h-6 mx-auto text-orange-500" />
            <div className="text-2xl font-bold text-orange-700">{todayStats?.commentsCount || 0}</div>
            <div className="text-sm text-gray-600">Comments</div>
            {settings && (
              <div className="text-xs text-gray-400">/ {settings.dailyCommentLimit}</div>
            )}
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Clock className="w-6 h-6 mx-auto text-gray-500" />
            <div className="text-2xl font-bold text-gray-700">{todayStats?.totalCount || 0}</div>
            <div className="text-sm text-gray-600">Total</div>
            {settings && (
              <div className="text-xs text-gray-400">/ {settings.dailyTotalLimit}</div>
            )}
          </div>
        </div>
      </div>

      {/* Action Queue */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Action Queue</h3>

          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">
              {queueStats?.pending || 0} pending • {queueStats?.completed || 0} completed • {queueStats?.failed || 0} failed
            </div>

            <select
              className="input py-1"
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>

            <button onClick={fetchQueue} className="btn btn-secondary p-2">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clear buttons */}
        {(queueStats?.completed || 0) > 0 || (queueStats?.failed || 0) > 0 ? (
          <div className="flex gap-2 mb-4">
            {(queueStats?.completed || 0) > 0 && (
              <button
                onClick={() => handleClearQueue('completed')}
                className="btn btn-secondary text-sm"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear Completed
              </button>
            )}
            {(queueStats?.failed || 0) > 0 && (
              <button
                onClick={() => handleClearQueue('failed')}
                className="btn btn-secondary text-sm text-red-600"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear Failed
              </button>
            )}
          </div>
        ) : null}

        {/* Queue list */}
        {queue.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No actions in queue
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {queue.map((action) => (
              <div key={action.id} className="py-3 flex items-center gap-4">
                {ACTION_ICONS[action.actionType] || <Settings className="w-4 h-4 text-gray-400" />}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{action.actionType}</span>
                    <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[action.status]}`}>
                      {action.status}
                    </span>
                  </div>
                  <a
                    href={action.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate block"
                  >
                    {action.targetName || action.targetUrl}
                  </a>
                  {action.errorMessage && (
                    <div className="text-sm text-red-600">{action.errorMessage}</div>
                  )}
                </div>

                <div className="text-xs text-gray-400">
                  {action.attempts > 0 && `${action.attempts} attempts`}
                </div>
              </div>
            ))}
          </div>
        )}

        {queueTotal > 10 && (
          <div className="text-center text-sm text-gray-500 mt-4">
            Showing 10 of {queueTotal} actions
          </div>
        )}
      </div>
    </div>
  )
}
