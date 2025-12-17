'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, ThumbsUp, MessageCircle, Share2, User, ChevronDown, ChevronUp } from 'lucide-react'
import { ScrapingResult } from '@/types'

interface ResultsTableProps {
  results: ScrapingResult[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

interface Reaction {
  author?: {
    name?: string
    linkedinUrl?: string
    publicIdentifier?: string
    avatar?: { url?: string }
    info?: string
  }
  reactionType?: string
}

interface Comment {
  author?: {
    name?: string
    linkedinUrl?: string
    publicIdentifier?: string
    avatar?: { url?: string }
    info?: string
  }
  text?: string
  postedAt?: { date?: string }
  likesCount?: number
}

export function ResultsTable({ results, total, page, pageSize, onPageChange }: ResultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const totalPages = Math.ceil(total / pageSize)

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                </th>
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
              {results.map((result) => {
                const isExpanded = expandedRows.has(result.id)
                const rawData = result.rawData as any
                const reactions: Reaction[] = rawData?.reactions || []
                const comments: Comment[] = rawData?.comments || []
                const hasDetails = reactions.length > 0 || comments.length > 0

                return (
                  <>
                    <tr key={result.id} className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        {hasDetails && (
                          <button
                            onClick={() => toggleRow(result.id)}
                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                            title={isExpanded ? 'Collapse' : 'Show reactions & comments'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        )}
                      </td>
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
                    {isExpanded && (
                      <tr key={`${result.id}-details`} className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Reactions Section */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                <ThumbsUp className="w-4 h-4 text-blue-500" />
                                Reactions ({reactions.length})
                              </h4>
                              {reactions.length > 0 ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {reactions.map((reaction, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                                      {reaction.author?.avatar?.url ? (
                                        <img
                                          src={reaction.author.avatar.url}
                                          alt={reaction.author?.name || ''}
                                          className="w-8 h-8 rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                          <User className="w-4 h-4 text-gray-400" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          {reaction.author?.linkedinUrl ? (
                                            <a
                                              href={reaction.author.linkedinUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="font-medium text-sm text-blue-600 hover:underline truncate"
                                            >
                                              {reaction.author?.name || 'Unknown'}
                                            </a>
                                          ) : (
                                            <span className="font-medium text-sm text-gray-900 truncate">
                                              {reaction.author?.name || 'Unknown'}
                                            </span>
                                          )}
                                          {reaction.reactionType && (
                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                              {reaction.reactionType}
                                            </span>
                                          )}
                                        </div>
                                        {reaction.author?.info && (
                                          <p className="text-xs text-gray-500 truncate">
                                            {reaction.author.info}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No reactions data available</p>
                              )}
                            </div>

                            {/* Comments Section */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-green-500" />
                                Comments ({comments.length})
                              </h4>
                              {comments.length > 0 ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {comments.map((comment, idx) => (
                                    <div key={idx} className="p-2 bg-white rounded border">
                                      <div className="flex items-start gap-2">
                                        {comment.author?.avatar?.url ? (
                                          <img
                                            src={comment.author.avatar.url}
                                            alt={comment.author?.name || ''}
                                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4 text-gray-400" />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {comment.author?.linkedinUrl ? (
                                              <a
                                                href={comment.author.linkedinUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-sm text-blue-600 hover:underline"
                                              >
                                                {comment.author?.name || 'Unknown'}
                                              </a>
                                            ) : (
                                              <span className="font-medium text-sm text-gray-900">
                                                {comment.author?.name || 'Unknown'}
                                              </span>
                                            )}
                                            {comment.postedAt?.date && (
                                              <span className="text-xs text-gray-400">
                                                {format(new Date(comment.postedAt.date), 'MMM d, yyyy')}
                                              </span>
                                            )}
                                          </div>
                                          {comment.author?.info && (
                                            <p className="text-xs text-gray-500 truncate">
                                              {comment.author.info}
                                            </p>
                                          )}
                                          {comment.text && (
                                            <p className="text-sm text-gray-700 mt-1">
                                              {comment.text}
                                            </p>
                                          )}
                                          {comment.likesCount !== undefined && comment.likesCount > 0 && (
                                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                              <ThumbsUp className="w-3 h-3" />
                                              {comment.likesCount}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No comments data available</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
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
