import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ActionType, LeadStatus, LeadTemperature } from '@prisma/client'

// POST /api/campaigns/[id]/leads/queue - Queue actions for leads
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = parseInt(id)
  const body = await request.json()

  const { action, hotFirst } = body // action: 'CONNECT' | 'MESSAGE1'

  // Get campaign with settings
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId }
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (!campaign.isActive) {
    return NextResponse.json({ error: 'Campaign is paused', reason: campaign.pausedReason }, { status: 400 })
  }

  // Get today's action counts for this campaign
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayActions = await prisma.actionQueue.groupBy({
    by: ['actionType'],
    where: {
      campaignId,
      createdAt: { gte: today }
    },
    _count: true
  })

  const todayConnects = todayActions.find(a => a.actionType === 'CONNECT_NO_NOTE')?._count || 0
  const todayMessages = todayActions.find(a => a.actionType === 'MESSAGE1')?._count || 0

  if (action === 'CONNECT') {
    // Get NEW leads to invite (HOT first if specified)
    const remainingInvites = campaign.invitesPerDay - todayConnects

    if (remainingInvites <= 0) {
      return NextResponse.json({ error: 'Daily invite limit reached', queued: 0 }, { status: 400 })
    }

    const orderBy: Array<Record<string, 'asc' | 'desc'>> = hotFirst
      ? [{ temperature: 'asc' }, { createdAt: 'asc' }] // HOT first (enum order)
      : [{ createdAt: 'asc' }]

    const leads = await prisma.campaignLead.findMany({
      where: {
        campaignId,
        status: LeadStatus.NEW
      },
      orderBy,
      take: remainingInvites
    })

    // Create CONNECT_NO_NOTE actions
    let queued = 0
    for (const lead of leads) {
      // Check if action already exists for this lead
      const existing = await prisma.actionQueue.findFirst({
        where: {
          campaignLeadId: lead.id,
          actionType: ActionType.CONNECT_NO_NOTE,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      })

      if (!existing) {
        await prisma.actionQueue.create({
          data: {
            actionType: ActionType.CONNECT_NO_NOTE,
            targetUrl: lead.profileUrl,
            targetName: lead.name,
            campaignId,
            campaignLeadId: lead.id,
            priority: lead.temperature === LeadTemperature.HOT ? 10 : 0
          }
        })
        queued++
      }
    }

    return NextResponse.json({ queued, limit: campaign.invitesPerDay, used: todayConnects })

  } else if (action === 'MESSAGE1') {
    // Get CONNECTED leads to message
    const remainingMessages = campaign.messagesPerDay - todayMessages

    if (remainingMessages <= 0) {
      return NextResponse.json({ error: 'Daily message limit reached', queued: 0 }, { status: 400 })
    }

    if (!campaign.message1Template) {
      return NextResponse.json({ error: 'No message template configured' }, { status: 400 })
    }

    const leads = await prisma.campaignLead.findMany({
      where: {
        campaignId,
        status: LeadStatus.CONNECTED
      },
      orderBy: [
        { temperature: 'asc' }, // HOT first
        { connectedAt: 'asc' } // Oldest connections first
      ],
      take: remainingMessages
    })

    // Create MESSAGE1 actions
    let queued = 0
    for (const lead of leads) {
      // Check if action already exists
      const existing = await prisma.actionQueue.findFirst({
        where: {
          campaignLeadId: lead.id,
          actionType: ActionType.MESSAGE1,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      })

      if (!existing) {
        // Replace template variables
        let messageText = campaign.message1Template
        messageText = messageText.replace(/\{\{firstName\}\}/g, lead.firstName || lead.name.split(' ')[0] || '')
        messageText = messageText.replace(/\{\{landingUrl\}\}/g, campaign.landingUrl || '')

        await prisma.actionQueue.create({
          data: {
            actionType: ActionType.MESSAGE1,
            targetUrl: lead.profileUrl,
            targetName: lead.name,
            messageText,
            campaignId,
            campaignLeadId: lead.id,
            priority: lead.temperature === LeadTemperature.HOT ? 10 : 0
          }
        })
        queued++
      }
    }

    return NextResponse.json({ queued, limit: campaign.messagesPerDay, used: todayMessages })
  }

  return NextResponse.json({ error: 'Invalid action type' }, { status: 400 })
}
