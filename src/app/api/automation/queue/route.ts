import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ActionType, ActionStatus } from '@prisma/client'

// GET /api/automation/queue - List queued actions
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const status = searchParams.get('status') || '' // PENDING, COMPLETED, FAILED

  const where: any = {}
  if (status) {
    where.status = status
  }

  const [actions, total] = await Promise.all([
    prisma.actionQueue.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // PENDING first
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.actionQueue.count({ where }),
  ])

  return NextResponse.json({
    actions,
    total,
    page,
    pageSize,
  })
}

// POST /api/automation/queue - Add action to queue
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { actionType, targetUrl, targetName, messageText, engagementId, priority } = body

  if (!actionType || !targetUrl) {
    return NextResponse.json(
      { error: 'actionType and targetUrl required' },
      { status: 400 }
    )
  }

  // Validate action type
  if (!Object.values(ActionType).includes(actionType)) {
    return NextResponse.json(
      { error: 'Invalid actionType' },
      { status: 400 }
    )
  }

  // Check if similar action already in queue
  const existing = await prisma.actionQueue.findFirst({
    where: {
      actionType,
      targetUrl,
      status: { in: [ActionStatus.PENDING, ActionStatus.IN_PROGRESS] },
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'Action already in queue', existing },
      { status: 409 }
    )
  }

  const action = await prisma.actionQueue.create({
    data: {
      actionType,
      targetUrl,
      targetName,
      messageText,
      engagementId,
      priority: priority || 0,
    },
  })

  return NextResponse.json({ success: true, action })
}

// DELETE /api/automation/queue - Remove actions from queue
export async function DELETE(request: NextRequest) {
  const body = await request.json()
  const { ids, clearCompleted, clearFailed } = body

  if (clearCompleted) {
    await prisma.actionQueue.deleteMany({
      where: { status: ActionStatus.COMPLETED },
    })
    return NextResponse.json({ success: true, message: 'Cleared completed actions' })
  }

  if (clearFailed) {
    await prisma.actionQueue.deleteMany({
      where: { status: ActionStatus.FAILED },
    })
    return NextResponse.json({ success: true, message: 'Cleared failed actions' })
  }

  if (ids && Array.isArray(ids)) {
    await prisma.actionQueue.deleteMany({
      where: { id: { in: ids } },
    })
    return NextResponse.json({ success: true, deleted: ids.length })
  }

  return NextResponse.json({ error: 'ids, clearCompleted, or clearFailed required' }, { status: 400 })
}
