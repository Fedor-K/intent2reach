import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/campaigns - List all campaigns
export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { leads: true }
      }
    }
  })

  return NextResponse.json(campaigns)
}

// POST /api/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  const body = await request.json()

  const { name, message1Template, landingUrl, invitesPerDay, messagesPerDay, workingHoursStart, workingHoursEnd } = body

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const campaign = await prisma.campaign.create({
    data: {
      name,
      message1Template: message1Template || null,
      landingUrl: landingUrl || null,
      invitesPerDay: invitesPerDay || 20,
      messagesPerDay: messagesPerDay || 50,
      workingHoursStart: workingHoursStart ?? 9,
      workingHoursEnd: workingHoursEnd ?? 18,
    }
  })

  return NextResponse.json(campaign)
}
