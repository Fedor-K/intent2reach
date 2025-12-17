'use client'

import { format } from 'date-fns'
import { Eye, StopCircle, RefreshCw } from 'lucide-react'
import { ScrapingRun } from '@/types'
import { StatusBadge } from './StatusBadge'

interface RunsTableProps {
  runs: ScrapingRun[]
  onViewResults: (runId: number) => void
  onAbort: (runId: number) => void
  onRefresh: (runId: number) => void
  isAborting: boolean
}

export function RunsTable({ runs, onViewResults, onAbort, onRefresh, isAborting }: RunsTableProps) {
  if (runs.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No scraping runs yet. Create one to get started!</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Query
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Results
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  #{run.id}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {run.searchQueries?.join(', ') ||
                   run.authorUrls?.slice(0, 2).join(', ') ||
                   run.authorsCompanies?.join(', ') ||
                   '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {run.resultsCount}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {format(new Date(run.createdAt), 'MMM d, HH:mm')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {run.status === 'SUCCEEDED' && (
                      <button
                        onClick={() => onViewResults(run.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="View Results"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {run.status === 'RUNNING' && (
                      <>
                        <button
                          onClick={() => onRefresh(run.id)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                          title="Refresh Status"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onAbort(run.id)}
                          disabled={isAborting}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          title="Abort"
                        >
                          <StopCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
