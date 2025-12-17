import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/automation/stats - Get daily stats
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get('days') || '7')

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const stats = await prisma.dailyStats.findMany({
    where: {
      date: { gte: startDate },
    },
    orderBy: { date: 'desc' },
  })

  // Calculate totals
  const totals = stats.reduce(
    (acc, day) => ({
      likes: acc.likes + day.likesCount,
      connects: acc.connects + day.connectsCount,
      messages: acc.messages + day.messagesCount,
      comments: acc.comments + day.commentsCount,
      total: acc.total + day.totalCount,
    }),
    { likes: 0, connects: 0, messages: 0, comments: 0, total: 0 }
  )

  // Get today's stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStats = stats.find(s => s.date.getTime() === today.getTime())

  return NextResponse.json({
    daily: stats,
    totals,
    today: todayStats || {
      likesCount: 0,
      connectsCount: 0,
      messagesCount: 0,
      commentsCount: 0,
      totalCount: 0,
    },
  })
}
