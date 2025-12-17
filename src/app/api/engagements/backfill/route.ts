import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Helper to extract author info
function extractPersonInfo(item: any) {
  const author = item?.author || item?.actor || item?.user || item
  return {
    name: author?.name || author?.fullName || author?.displayName || null,
    linkedinUrl: author?.linkedinUrl || author?.profileUrl || author?.url || null,
    position: author?.position || author?.info || author?.headline || author?.title || null,
    avatarUrl: author?.picture?.url || author?.pictureUrl || author?.avatar?.url || author?.avatarUrl || null,
  }
}

// POST /api/engagements/backfill - Extract engagements from all existing results
export async function POST() {
  try {
    // Get all results with rawData
    const results = await prisma.scrapingResult.findMany({
      select: {
        id: true,
        runId: true,
        rawData: true,
        postUrl: true,
        postText: true,
        authorName: true,
        authorUrl: true,
        run: {
          select: {
            searchQueries: true,
          }
        }
      },
    })

    console.log(`Processing ${results.length} results for engagement extraction`)

    let savedCount = 0
    let skippedCount = 0

    for (const result of results) {
      const rawData = result.rawData as any
      if (!rawData) continue

      const postUrl = rawData.linkedinUrl || result.postUrl || rawData.postUrl || rawData.url || ''
      if (!postUrl) continue

      const postText = (rawData.content || result.postText || '')?.slice(0, 200)
      const postAuthorName = rawData.author?.name || result.authorName
      const postAuthorUrl = rawData.author?.linkedinUrl || result.authorUrl
      const searchQuery = result.run?.searchQueries?.[0] || null

      // Extract from reactions
      const reactions = rawData.reactions || []
      for (const reaction of reactions) {
        const info = extractPersonInfo(reaction)
        if (!info.linkedinUrl || !info.name) continue

        try {
          await prisma.engagement.upsert({
            where: {
              personLinkedinUrl_postUrl_engagementType: {
                personLinkedinUrl: info.linkedinUrl,
                postUrl: postUrl,
                engagementType: reaction.reactionType || 'LIKE',
              }
            },
            create: {
              personLinkedinUrl: info.linkedinUrl,
              personName: info.name,
              personPosition: info.position,
              personAvatarUrl: info.avatarUrl,
              engagementType: reaction.reactionType || 'LIKE',
              postUrl,
              postText,
              postAuthorName,
              postAuthorUrl,
              searchQuery,
              runId: result.runId,
              resultId: result.id,
            },
            update: {
              personName: info.name,
              personPosition: info.position || undefined,
              personAvatarUrl: info.avatarUrl || undefined,
            },
          })
          savedCount++
        } catch (error) {
          skippedCount++
        }
      }

      // Extract from comments
      const comments = rawData.comments || []
      for (const comment of comments) {
        const info = extractPersonInfo(comment)
        if (!info.linkedinUrl || !info.name) continue

        const commentText = comment.commentary || comment.text || comment.content || null
        const engagedAt = comment.createdAt ? new Date(comment.createdAt) : null

        try {
          await prisma.engagement.upsert({
            where: {
              personLinkedinUrl_postUrl_engagementType: {
                personLinkedinUrl: info.linkedinUrl,
                postUrl: postUrl,
                engagementType: 'COMMENT',
              }
            },
            create: {
              personLinkedinUrl: info.linkedinUrl,
              personName: info.name,
              personPosition: info.position,
              personAvatarUrl: info.avatarUrl,
              engagementType: 'COMMENT',
              postUrl,
              postText,
              postAuthorName,
              postAuthorUrl,
              commentText,
              searchQuery,
              runId: result.runId,
              resultId: result.id,
              engagedAt,
            },
            update: {
              personName: info.name,
              personPosition: info.position || undefined,
              personAvatarUrl: info.avatarUrl || undefined,
              commentText: commentText || undefined,
            },
          })
          savedCount++
        } catch (error) {
          skippedCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      resultsProcessed: results.length,
      engagementsSaved: savedCount,
      skipped: skippedCount,
    })
  } catch (error) {
    console.error('Backfill failed:', error)
    return NextResponse.json(
      { error: 'Failed to backfill engagements' },
      { status: 500 }
    )
  }
}
