'use client'

import { format } from 'date-fns'
import { ExternalLink, ThumbsUp, MessageCircle, Share2, User } from 'lucide-react'
import { ScrapingResult } from '@/types'

interface ResultsTableProps {
  results: ScrapingResult[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function ResultsTable({ results, total, page, pageSize, onPageChange }: ResultsTableProps) {
  const totalPages = Math.ceil(total / pageSize)

  if (results.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No results found for this run.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Author
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Post
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Engagement
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Links
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.map((result) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {result.authorAvatarUrl ? (
                        <img
                          src={result.authorAvatarUrl}
                          alt={result.authorName || 'Avatar'}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]">
                          {result.authorName || 'Unknown'}
                        </div>
                        {result.authorUsername && (
                          <div className="text-xs text-blue-600">
                            @{result.authorUsername}
                          </div>
                        )}
                        <div className="text-gray-500 text-xs truncate max-w-[200px]">
                          {result.authorHeadline || '-'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600 max-w-md">
                      {result.postType && (
                        <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded mb-1">
                          {result.postType}
                        </span>
                      )}
                      <p className="line-clamp-3">{result.postText || '-'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
                        {result.likesCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                        {result.commentsCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5 text-orange-500" />
                        {result.sharesCount}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {result.postDate
                      ? format(new Date(result.postDate), 'MMM d, yyyy')
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      {result.postUrl && (
                        <a
                          href={result.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Post
                        </a>
                      )}
                      {result.authorUrl && (
                        <a
                          href={result.authorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm"
                        >
                          <User className="w-3.5 h-3.5" />
                          Profile
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="flex items-center px-3 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
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
