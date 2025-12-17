export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED'

export interface ScrapingRun {
  id: number
  apifyRunId: string | null
  status: RunStatus
  searchQueries: string[]
  authorUrls: string[]
  authorsCompanies: string[]
  postedLimit: string
  maxPosts: number
  maxComments: number
  maxReactions: number
  scrapeComments: boolean
  scrapeReactions: boolean
  scrapePages: number
  sortBy: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  resultsCount: number
}

export interface ScrapingResult {
  id: number
  runId: number
  postType: string | null
  postUrl: string | null
  postId: string | null
  postText: string | null
  postDate: string | null
  authorName: string | null
  authorUrl: string | null
  authorUsername: string | null
  authorHeadline: string | null
  authorAvatarUrl: string | null
  likesCount: number
  commentsCount: number
  sharesCount: number
  rawData: any
  createdAt: string
}

export interface CreateRunRequest {
  searchQueries?: string[]
  authorUrls?: string[]
  authorsCompanies?: string[]
  postedLimit?: string
  maxPosts?: number
  maxComments?: number
  maxReactions?: number
  scrapeComments?: boolean
  scrapeReactions?: boolean
  scrapePages?: number
  sortBy?: string
}

export interface Lead {
  id: number
  linkedinUrl: string
  linkedinId: string | null
  name: string
  position: string | null
  avatarUrl: string | null
  engagementTypes: string[]
  sourcePostUrls: string[]
  sourceRunIds: number[]
  firstSeenAt: string
  lastSeenAt: string
}
