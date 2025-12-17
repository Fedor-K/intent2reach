import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const DEFAULT_SETTINGS = {
  dailyLikeLimit: 20,
  dailyConnectLimit: 10,
  dailyMessageLimit: 10,
  dailyCommentLimit: 5,
  dailyTotalLimit: 50,
  minDelayBetweenActions: 30,
  maxDelayBetweenActions: 90,
  workingHoursStart: 9,
  workingHoursEnd: 18,
  enableRandomPauses: true,
  pauseMinMinutes: 5,
  pauseMaxMinutes: 15,
}

// GET /api/automation/settings - Get current settings
export async function GET() {
  let settings = await prisma.automationSettings.findFirst()

  if (!settings) {
    // Create default settings
    settings = await prisma.automationSettings.create({
      data: DEFAULT_SETTINGS,
    })
  }

  return NextResponse.json(settings)
}

// PUT /api/automation/settings - Update settings
export async function PUT(request: NextRequest) {
  const body = await request.json()

  // Validate
  const validFields = [
    'dailyLikeLimit',
    'dailyConnectLimit',
    'dailyMessageLimit',
    'dailyCommentLimit',
    'dailyTotalLimit',
    'minDelayBetweenActions',
    'maxDelayBetweenActions',
    'workingHoursStart',
    'workingHoursEnd',
    'enableRandomPauses',
    'pauseMinMinutes',
    'pauseMaxMinutes',
  ]

  const updateData: any = {}
  for (const field of validFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Get or create settings
  let settings = await prisma.automationSettings.findFirst()

  if (settings) {
    settings = await prisma.automationSettings.update({
      where: { id: settings.id },
      data: updateData,
    })
  } else {
    settings = await prisma.automationSettings.create({
      data: { ...DEFAULT_SETTINGS, ...updateData },
    })
  }

  return NextResponse.json(settings)
}
