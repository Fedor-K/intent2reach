import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Note: Browser automation runs as a separate process (scripts/automation.ts)
// This API only provides status and queue management

// GET /api/automation/session - Get session status
export async function GET() {
  // Get session from DB
  let session = null
  try {
    session = await prisma.automationSession.findFirst({
      orderBy: { updatedAt: 'desc' },
    })
  } catch {}

  // Get today's stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let todayStats = {
    likesCount: 0,
    connectsCount: 0,
    messagesCount: 0,
    commentsCount: 0,
    totalCount: 0,
  }

  try {
    const stats = await prisma.dailyStats.findUnique({
      where: { date: today },
    })
    if (stats) {
      todayStats = {
        likesCount: stats.likesCount,
        connectsCount: stats.connectsCount,
        messagesCount: stats.messagesCount,
        commentsCount: stats.commentsCount,
        totalCount: stats.totalCount,
      }
    }
  } catch {}

  // Get queue stats
  let queueStats = { pending: 0, completed: 0, failed: 0 }
  try {
    const [pending, completed, failed] = await Promise.all([
      prisma.actionQueue.count({ where: { status: 'PENDING' } }),
      prisma.actionQueue.count({ where: { status: 'COMPLETED' } }),
      prisma.actionQueue.count({ where: { status: 'FAILED' } }),
    ])
    queueStats = { pending, completed, failed }
  } catch {}

  return NextResponse.json({
    browser: session ? {
      isRunning: session.isActive,
      isLoggedIn: session.isLoggedIn,
      isPaused: session.isPaused,
      linkedinName: session.linkedinName,
      linkedinUrl: session.linkedinUrl,
      lastCheckedAt: session.updatedAt,
      error: null,
    } : {
      isRunning: false,
      isLoggedIn: false,
      isPaused: false,
      linkedinName: null,
      linkedinUrl: null,
      lastCheckedAt: null,
      error: null,
    },
    todayStats,
    queueStats,
  })
}

// POST /api/automation/session - Update session state (called by automation script)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action, isActive, isLoggedIn, isPaused, linkedinName, linkedinUrl } = body

  try {
    // If action is pause/resume, update the session
    if (action === 'pause' || action === 'resume') {
      const session = await prisma.automationSession.findFirst({
        orderBy: { updatedAt: 'desc' },
      })

      if (session) {
        await prisma.automationSession.update({
          where: { id: session.id },
          data: { isPaused: action === 'pause' },
        })
      }

      return NextResponse.json({ success: true, message: action === 'pause' ? 'Paused' : 'Resumed' })
    }

    // Update session state (from automation script)
    if (isActive !== undefined || isLoggedIn !== undefined) {
      let session = await prisma.automationSession.findFirst({
        orderBy: { updatedAt: 'desc' },
      })

      if (session) {
        await prisma.automationSession.update({
          where: { id: session.id },
          data: {
            isActive: isActive ?? session.isActive,
            isLoggedIn: isLoggedIn ?? session.isLoggedIn,
            isPaused: isPaused ?? session.isPaused,
            linkedinName: linkedinName ?? session.linkedinName,
            linkedinUrl: linkedinUrl ?? session.linkedinUrl,
          },
        })
      } else {
        await prisma.automationSession.create({
          data: {
            isActive: isActive ?? false,
            isLoggedIn: isLoggedIn ?? false,
            isPaused: isPaused ?? false,
            linkedinName,
            linkedinUrl,
          },
        })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
