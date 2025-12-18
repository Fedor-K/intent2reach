'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Database, RefreshCw, Activity, Bot } from 'lucide-react'
import { CreateRunForm } from '@/components/CreateRunForm'
import { RunsTable } from '@/components/RunsTable'
import { ResultsTable } from '@/components/ResultsTable'
import { EngagementsTable } from '@/components/EngagementsTable'
import { AutomationWrapper } from '@/components/AutomationWrapper'
import { ScrapingRun, ScrapingResult, CreateRunRequest } from '@/types'

type TabType = 'scraping' | 'activity' | 'automation'

export default function Dashboard() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('scraping')

  // Runs state
  const [runs, setRuns] = useState<ScrapingRun[]>([])
  const [runsTotal, setRunsTotal] = useState(0)
  const [runsPage, setRunsPage] = useState(1)
  const [runsLoading, setRunsLoading] = useState(true)

  // Results state
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [results, setResults] = useState<ScrapingResult[]>([])
  const [resultsTotal, setResultsTotal] = useState(0)
  const [resultsPage, setResultsPage] = useState(1)
  const [resultsLoading, setResultsLoading] = useState(false)

  // Action states
  const [isCreating, setIsCreating] = useState(false)
  const [isAborting, setIsAborting] = useState(false)
  const [isRepeating, setIsRepeating] = useState(false)

  // Fetch runs
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/scraping/runs?page=${runsPage}&pageSize=20`)
      const data = await res.json()
      setRuns(data.runs)
      setRunsTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch runs:', error)
    } finally {
      setRunsLoading(false)
    }
  }, [runsPage])

  // Fetch results
  const fetchResults = useCallback(async () => {
    if (!selectedRunId) return

    setResultsLoading(true)
    try {
      const res = await fetch(`/api/scraping/runs/${selectedRunId}/results?page=${resultsPage}&pageSize=50`)
      const data = await res.json()
      setResults(data.results)
      setResultsTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch results:', error)
    } finally {
      setResultsLoading(false)
    }
  }, [selectedRunId, resultsPage])

  // Initial load and auto-refresh
  useEffect(() => {
    fetchRuns()
    const interval = setInterval(fetchRuns, 5000) // Auto-refresh every 5s
    return () => clearInterval(interval)
  }, [fetchRuns])

  // Fetch results when run selected
  useEffect(() => {
    if (selectedRunId) {
      fetchResults()
    }
  }, [selectedRunId, fetchResults])

  // Create new run
  const handleCreateRun = async (params: CreateRunRequest) => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/scraping/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (res.ok) {
        await fetchRuns()
      }
    } catch (error) {
      console.error('Failed to create run:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Abort run
  const handleAbort = async (runId: number) => {
    setIsAborting(true)
    try {
      await fetch(`/api/scraping/runs/${runId}/abort`, { method: 'POST' })
      await fetchRuns()
    } catch (error) {
      console.error('Failed to abort run:', error)
    } finally {
      setIsAborting(false)
    }
  }

  // Refresh run status
  const handleRefreshStatus = async (runId: number) => {
    try {
      await fetch(`/api/scraping/runs/${runId}/status`)
      await fetchRuns()
    } catch (error) {
      console.error('Failed to refresh status:', error)
    }
  }

  // Repeat run with same parameters
  const handleRepeat = async (run: ScrapingRun) => {
    setIsRepeating(true)
    try {
      const params: CreateRunRequest = {
        searchQueries: run.searchQueries,
        authorUrls: run.authorUrls,
        authorsCompanies: run.authorsCompanies,
        postedLimit: run.postedLimit,
        maxPosts: run.maxPosts,
        scrapeComments: run.scrapeComments,
        scrapeReactions: run.scrapeReactions,
      }

      const res = await fetch('/api/scraping/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (res.ok) {
        await fetchRuns()
      }
    } catch (error) {
      console.error('Failed to repeat run:', error)
    } finally {
      setIsRepeating(false)
    }
  }

  // View results
  const handleViewResults = (runId: number) => {
    setSelectedRunId(runId)
    setResultsPage(1)
  }

  // Back to runs list
  const handleBack = () => {
    setSelectedRunId(null)
    setResults([])
    setResultsPage(1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Intent2Reach</h1>
                <p className="text-sm text-gray-500">LinkedIn Scraping Dashboard</p>
              </div>
            </div>
            <button
              onClick={fetchRuns}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('scraping')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'scraping'
                  ? 'bg-gray-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Scraping
              </div>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'activity'
                  ? 'bg-gray-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Activity Feed
              </div>
            </button>
            <button
              onClick={() => setActiveTab('automation')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'automation'
                  ? 'bg-gray-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Automation
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'automation' ? (
          // Automation Panel
          <AutomationWrapper />
        ) : activeTab === 'activity' ? (
          // Activity Feed View
          <EngagementsTable />
        ) : selectedRunId ? (
          // Results View
          <div className="space-y-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to runs
            </button>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Results for Run #{selectedRunId}
              </h2>
              <span className="text-sm text-gray-500">
                {resultsTotal} total results
              </span>
            </div>

            {resultsLoading ? (
              <div className="card text-center py-12">
                <p className="text-gray-500">Loading results...</p>
              </div>
            ) : (
              <ResultsTable
                results={results}
                total={resultsTotal}
                page={resultsPage}
                pageSize={50}
                onPageChange={setResultsPage}
              />
            )}
          </div>
        ) : (
          // Main Dashboard
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Run Form */}
            <div className="lg:col-span-1">
              <CreateRunForm
                onSubmit={handleCreateRun}
                isLoading={isCreating}
              />
            </div>

            {/* Runs List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Scraping Runs</h2>
                <span className="text-sm text-gray-500">
                  {runsTotal} total runs
                </span>
              </div>

              {runsLoading ? (
                <div className="card text-center py-12">
                  <p className="text-gray-500">Loading runs...</p>
                </div>
              ) : (
                <>
                  <RunsTable
                    runs={runs}
                    onViewResults={handleViewResults}
                    onAbort={handleAbort}
                    onRefresh={handleRefreshStatus}
                    onRepeat={handleRepeat}
                    isAborting={isAborting}
                    isRepeating={isRepeating}
                  />

                  {runsTotal > 20 && (
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setRunsPage((p) => Math.max(1, p - 1))}
                        disabled={runsPage <= 1}
                        className="btn btn-secondary text-sm disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="flex items-center px-3 text-sm text-gray-600">
                        Page {runsPage}
                      </span>
                      <button
                        onClick={() => setRunsPage((p) => p + 1)}
                        disabled={runsPage * 20 >= runsTotal}
                        className="btn btn-secondary text-sm disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-gray-500 text-center">
            Intent2Reach - LinkedIn Intelligence Platform
          </p>
        </div>
      </footer>
    </div>
  )
}
