import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { LeadStatus, LeadTemperature } from '@prisma/client'

// GET /api/campaigns/[id]/leads - List leads for campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = parseInt(id)

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as LeadStatus | null
  const temperature = searchParams.get('temperature') as LeadTemperature | null
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  const where: Record<string, unknown> = { campaignId }
  if (status) where.status = status
  if (temperature) where.temperature = temperature

  const [leads, total] = await Promise.all([
    prisma.campaignLead.findMany({
      where,
      orderBy: [
        { temperature: 'asc' }, // HOT first
        { createdAt: 'desc' }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.campaignLead.count({ where })
  ])

  return NextResponse.json({ leads, total, page, pageSize })
}

// POST /api/campaigns/[id]/leads - Import leads from scraping run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = parseInt(id)
  const body = await request.json()

  const { runId, source } = body // source: 'commenters' | 'reactors' | 'both'

  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 })
  }

  // Get scraping results with raw data
  const results = await prisma.scrapingResult.findMany({
    where: { runId: parseInt(runId) },
    select: { rawData: true, postUrl: true }
  })

  const leadsToImport: Array<{
    profileUrl: string
    name: string
    firstName: string | null
    headline: string | null
    avatarUrl: string | null
    sourcePostUrl: string | null
  }> = []

  for (const result of results) {
    const rawData = result.rawData as Record<string, unknown> | null
    if (!rawData) continue

    // Extract commenters
    if (source === 'commenters' || source === 'both') {
      const comments = (rawData.comments as Array<Record<string, unknown>>) || []
      for (const comment of comments) {
        const authorUrl = comment.linkedInUrl as string | undefined
        const authorName = comment.authorName as string | undefined
        if (authorUrl && authorName) {
          leadsToImport.push({
            profileUrl: authorUrl,
            name: authorName,
            firstName: extractFirstName(authorName),
            headline: comment.authorHeadline as string | null || null,
            avatarUrl: comment.authorProfilePicture as string | null || null,
            sourcePostUrl: result.postUrl
          })
        }
      }
    }

    // Extract reactors
    if (source === 'reactors' || source === 'both') {
      const reactions = (rawData.reactions as Array<Record<string, unknown>>) || []
      for (const reaction of reactions) {
        const authorUrl = reaction.linkedInUrl as string | undefined
        const authorName = reaction.authorName as string | undefined
        if (authorUrl && authorName) {
          leadsToImport.push({
            profileUrl: authorUrl,
            name: authorName,
            firstName: extractFirstName(authorName),
            headline: reaction.authorHeadline as string | null || null,
            avatarUrl: reaction.authorProfilePicture as string | null || null,
            sourcePostUrl: result.postUrl
          })
        }
      }
    }
  }

  // Deduplicate by profileUrl
  const uniqueLeads = new Map<string, typeof leadsToImport[0]>()
  for (const lead of leadsToImport) {
    if (!uniqueLeads.has(lead.profileUrl)) {
      uniqueLeads.set(lead.profileUrl, lead)
    }
  }

  // Import leads (skip duplicates within campaign)
  let imported = 0
  let skipped = 0

  for (const lead of uniqueLeads.values()) {
    try {
      await prisma.campaignLead.create({
        data: {
          campaignId,
          ...lead,
          sourceRunId: parseInt(runId)
        }
      })
      imported++
    } catch (error) {
      // Unique constraint violation = already exists
      skipped++
    }
  }

  // Update campaign stats
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      totalLeads: { increment: imported }
    }
  })

  return NextResponse.json({ imported, skipped, total: leadsToImport.length })
}

// PUT /api/campaigns/[id]/leads - Bulk update leads
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = parseInt(id)
  const body = await request.json()

  const { leadIds, updates } = body

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'leadIds array is required' }, { status: 400 })
  }

  const validFields = ['status', 'temperature', 'notes']
  const updateData: Record<string, unknown> = {}

  for (const field of validFields) {
    if (updates?.[field] !== undefined) {
      updateData[field] = updates[field]
    }
  }

  // Add timestamps based on status change
  if (updates?.status === 'INVITED') updateData.invitedAt = new Date()
  if (updates?.status === 'CONNECTED') updateData.connectedAt = new Date()
  if (updates?.status === 'MSG1') updateData.msg1At = new Date()

  const result = await prisma.campaignLead.updateMany({
    where: {
      id: { in: leadIds },
      campaignId
    },
    data: updateData
  })

  return NextResponse.json({ updated: result.count })
}

function extractFirstName(fullName: string): string | null {
  if (!fullName) return null
  const parts = fullName.trim().split(' ')
  return parts[0] || null
}
