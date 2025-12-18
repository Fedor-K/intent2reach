import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/campaigns/[id] - Get campaign details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = parseInt(id)

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      _count: {
        select: { leads: true }
      }
    }
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Get lead stats by status
  const statusCounts = await prisma.campaignLead.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true
  })

  const temperatureCounts = await prisma.campaignLead.groupBy({
    by: ['temperature'],
    where: { campaignId },
    _count: true
  })

  return NextResponse.json({
    ...campaign,
    statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
    temperatureCounts: temperatureCounts.reduce((acc, t) => ({ ...acc, [t.temperature]: t._count }), {})
  })
}

// PUT /api/campaigns/[id] - Update campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = parseInt(id)
  const body = await request.json()

  const validFields = [
    'name',
    'message1Template',
    'landingUrl',
    'invitesPerDay',
    'messagesPerDay',
    'workingHoursStart',
    'workingHoursEnd',
    'isActive',
    'pausedReason'
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of validFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: updateData
  })

  return NextResponse.json(campaign)
}

// DELETE /api/campaigns/[id] - Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = parseInt(id)

  await prisma.campaign.delete({
    where: { id: campaignId }
  })

  return NextResponse.json({ success: true })
}
