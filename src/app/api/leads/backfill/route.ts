import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Helper to extract author info from reaction/comment
function extractLeadInfo(item: any) {
  const author = item?.author || item?.actor || item?.user || item
  return {
    name: author?.name || author?.fullName || author?.displayName || null,
    linkedinUrl: author?.linkedinUrl || author?.profileUrl || author?.url || null,
    linkedinId: author?.id || author?.publicIdentifier || null,
    position: author?.position || author?.info || author?.headline || author?.title || null,
    avatarUrl: author?.picture?.url || author?.pictureUrl || author?.avatar?.url || author?.avatarUrl || null,
  }
}

// POST /api/leads/backfill - Extract leads from all existing results
export async function POST() {
  try {
    // Get all results with rawData
    const results = await prisma.scrapingResult.findMany({
      select: {
        id: true,
        runId: true,
        rawData: true,
      }
    })

    console.log(`Processing ${results.length} results for lead extraction`)

    const leadsMap = new Map<string, {
      linkedinUrl: string
      linkedinId: string | null
      name: string
      position: string | null
      avatarUrl: string | null
      engagementTypes: Set<string>
      sourcePostUrls: Set<string>
      sourceRunIds: Set<number>
    }>()

    for (const result of results) {
      const rawData = result.rawData as any
      if (!rawData) continue

      const postUrl = rawData.linkedinUrl || rawData.postUrl || rawData.url || ''

      // Extract from reactions
      const reactions = rawData.reactions || []
      for (const reaction of reactions) {
        const info = extractLeadInfo(reaction)
        if (!info.linkedinUrl || !info.name) continue

        const existing = leadsMap.get(info.linkedinUrl)
        if (existing) {
          existing.engagementTypes.add(reaction.reactionType || 'LIKE')
          if (postUrl) existing.sourcePostUrls.add(postUrl)
          existing.sourceRunIds.add(result.runId)
        } else {
          leadsMap.set(info.linkedinUrl, {
            linkedinUrl: info.linkedinUrl,
            linkedinId: info.linkedinId,
            name: info.name,
            position: info.position,
            avatarUrl: info.avatarUrl,
            engagementTypes: new Set([reaction.reactionType || 'LIKE']),
            sourcePostUrls: new Set(postUrl ? [postUrl] : []),
            sourceRunIds: new Set([result.runId]),
          })
        }
      }

      // Extract from comments
      const comments = rawData.comments || []
      for (const comment of comments) {
        const info = extractLeadInfo(comment)
        if (!info.linkedinUrl || !info.name) continue

        const existing = leadsMap.get(info.linkedinUrl)
        if (existing) {
          existing.engagementTypes.add('COMMENT')
          if (postUrl) existing.sourcePostUrls.add(postUrl)
          existing.sourceRunIds.add(result.runId)
        } else {
          leadsMap.set(info.linkedinUrl, {
            linkedinUrl: info.linkedinUrl,
            linkedinId: info.linkedinId,
            name: info.name,
            position: info.position,
            avatarUrl: info.avatarUrl,
            engagementTypes: new Set(['COMMENT']),
            sourcePostUrls: new Set(postUrl ? [postUrl] : []),
            sourceRunIds: new Set([result.runId]),
          })
        }
      }
    }

    console.log(`Found ${leadsMap.size} unique leads`)

    // Upsert all leads
    const now = new Date()
    let savedCount = 0

    for (const [linkedinUrl, lead] of Array.from(leadsMap.entries())) {
      try {
        await prisma.lead.upsert({
          where: { linkedinUrl },
          create: {
            linkedinUrl,
            linkedinId: lead.linkedinId,
            name: lead.name,
            position: lead.position,
            avatarUrl: lead.avatarUrl,
            engagementTypes: Array.from(lead.engagementTypes),
            sourcePostUrls: Array.from(lead.sourcePostUrls),
            sourceRunIds: Array.from(lead.sourceRunIds),
            firstSeenAt: now,
            lastSeenAt: now,
          },
          update: {
            name: lead.name,
            position: lead.position || undefined,
            avatarUrl: lead.avatarUrl || undefined,
            linkedinId: lead.linkedinId || undefined,
            engagementTypes: {
              push: Array.from(lead.engagementTypes),
            },
            sourcePostUrls: {
              push: Array.from(lead.sourcePostUrls),
            },
            sourceRunIds: {
              push: Array.from(lead.sourceRunIds),
            },
            lastSeenAt: now,
          },
        })
        savedCount++
      } catch (error) {
        console.error(`Failed to save lead ${linkedinUrl}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      resultsProcessed: results.length,
      leadsFound: leadsMap.size,
      leadsSaved: savedCount,
    })
  } catch (error) {
    console.error('Backfill failed:', error)
    return NextResponse.json(
      { error: 'Failed to backfill leads' },
      { status: 500 }
    )
  }
}
