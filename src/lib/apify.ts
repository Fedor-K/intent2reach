import { ApifyClient } from 'apify-client'
import { prisma } from './db'
import { RunStatus } from '@prisma/client'

const ACTOR_ID = 'buIWk2uOUzTmcLsuB'

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
})

export interface CreateRunParams {
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

function buildActorInput(params: CreateRunParams) {
  const input = {
    searchQueries: params.searchQueries || [],
    authorUrls: params.authorUrls || [],
    authorsCompanies: params.authorsCompanies || [],
    postedLimit: params.postedLimit || '24h',
    commentsPostedLimit: params.postedLimit || '24h',
    maxPosts: params.maxPosts || 100,
    maxComments: params.maxComments || 100,
    maxReactions: params.maxReactions || 100,
    scrapeComments: params.scrapeComments ?? true,
    scrapeReactions: params.scrapeReactions ?? true,
    scrapePages: params.scrapePages || 1,
    sortBy: params.sortBy || 'date',
    startPage: 1,
  }
  console.log('Apify actor input:', JSON.stringify(input, null, 2))
  return input
}

export async function createScrapingRun(params: CreateRunParams) {
  // Create run record in DB
  const run = await prisma.scrapingRun.create({
    data: {
      status: RunStatus.PENDING,
      searchQueries: params.searchQueries || [],
      authorUrls: params.authorUrls || [],
      authorsCompanies: params.authorsCompanies || [],
      postedLimit: params.postedLimit || '24h',
      maxPosts: params.maxPosts || 100,
      maxComments: params.maxComments || 100,
      maxReactions: params.maxReactions || 100,
      scrapeComments: params.scrapeComments ?? true,
      scrapeReactions: params.scrapeReactions ?? true,
      scrapePages: params.scrapePages || 1,
      sortBy: params.sortBy || 'date',
    },
  })

  // Start actor async (don't wait)
  startActorAsync(run.id, params).catch(console.error)

  return run
}

async function startActorAsync(runId: number, params: CreateRunParams) {
  try {
    const actorInput = buildActorInput(params)

    // Update status to running
    await prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.RUNNING,
        startedAt: new Date(),
      },
    })

    // Start actor and wait for completion
    const actorRun = await client.actor(ACTOR_ID).call(actorInput)

    // Update with apify run id
    await prisma.scrapingRun.update({
      where: { id: runId },
      data: { apifyRunId: actorRun.id },
    })

    // Fetch results
    await fetchAndSaveResults(runId, actorRun.id)

  } catch (error) {
    console.error('Actor run failed:', error)
    await prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        finishedAt: new Date(),
      },
    })
  }
}

export async function fetchAndSaveResults(runId: number, apifyRunId: string) {
  try {
    // Get dataset items from Apify
    const { items } = await client.run(apifyRunId).dataset().listItems()

    // Delete existing results for this run
    await prisma.scrapingResult.deleteMany({
      where: { runId },
    })

    // Save new results
    if (items.length > 0) {
      await prisma.scrapingResult.createMany({
        data: items.map((item: any) => ({
          runId,
          // Post type
          postType: item.type || null,
          // Post data
          postUrl: item.linkedinUrl || item.postUrl || item.url || null,
          postId: item.id || item.postId || null,
          postText: item.content || item.text || item.postText || null,
          postDate: parseDate(item.postedAt?.date || item.postedDate || item.date),
          // Author data
          authorName: item.author?.name || item.authorName || null,
          authorUrl: item.author?.linkedinUrl || item.authorUrl || null,
          authorUsername: item.author?.publicIdentifier || null,
          authorHeadline: item.author?.info || item.authorHeadline || null,
          authorAvatarUrl: item.author?.avatar?.url || null,
          // Engagement
          likesCount: toInt(item.engagement?.likes ?? item.likesCount ?? item.likes),
          commentsCount: toInt(item.engagement?.comments ?? item.commentsCount ?? item.comments),
          sharesCount: toInt(item.engagement?.shares ?? item.sharesCount ?? item.shares),
          // Raw data for later access to reactions, comments, etc.
          rawData: item,
        })),
      })
    }

    // Update run status
    await prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.SUCCEEDED,
        resultsCount: items.length,
        finishedAt: new Date(),
      },
    })

    return items.length
  } catch (error) {
    console.error('Failed to fetch results:', error)
    await prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Failed to fetch results',
        finishedAt: new Date(),
      },
    })
    throw error
  }
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  try {
    return new Date(dateStr)
  } catch {
    return null
  }
}

function toInt(value: any): number {
  if (value === null || value === undefined || value === '') return 0
  const num = parseInt(String(value), 10)
  return isNaN(num) ? 0 : num
}

export async function checkRunStatus(runId: number) {
  const run = await prisma.scrapingRun.findUnique({
    where: { id: runId },
  })

  if (!run || !run.apifyRunId) return run

  try {
    const runInfo = await client.run(run.apifyRunId).get()
    const apifyStatus = runInfo?.status?.toUpperCase()

    const statusMap: Record<string, RunStatus> = {
      'READY': RunStatus.PENDING,
      'RUNNING': RunStatus.RUNNING,
      'SUCCEEDED': RunStatus.SUCCEEDED,
      'FAILED': RunStatus.FAILED,
      'ABORTED': RunStatus.ABORTED,
      'ABORTING': RunStatus.RUNNING,
      'TIMING-OUT': RunStatus.RUNNING,
      'TIMED-OUT': RunStatus.FAILED,
    }

    const newStatus = statusMap[apifyStatus || ''] || RunStatus.RUNNING

    const isFinished = newStatus === RunStatus.SUCCEEDED ||
                       newStatus === RunStatus.FAILED ||
                       newStatus === RunStatus.ABORTED

    const updated = await prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: newStatus,
        finishedAt: isFinished ? new Date() : undefined,
      },
    })

    return updated
  } catch (error) {
    console.error('Failed to check status:', error)
    return run
  }
}

export async function abortRun(runId: number) {
  const run = await prisma.scrapingRun.findUnique({
    where: { id: runId },
  })

  if (!run) {
    return run
  }

  // Only abort if pending or running
  if (run.status !== RunStatus.PENDING && run.status !== RunStatus.RUNNING) {
    return run
  }

  try {
    // If running with apifyRunId, abort on Apify
    if (run.apifyRunId && run.status === RunStatus.RUNNING) {
      try {
        await client.run(run.apifyRunId).abort()
      } catch (e) {
        console.error('Failed to abort on Apify:', e)
      }
    }

    // Update status in DB
    return await prisma.scrapingRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.ABORTED,
        finishedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Failed to abort run:', error)
    throw error
  }
}
