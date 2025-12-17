import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createScrapingRun, CreateRunParams } from '@/lib/apify'

// GET /api/scraping/runs - List all runs
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

  const skip = (page - 1) * pageSize

  const [runs, total] = await Promise.all([
    prisma.scrapingRun.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.scrapingRun.count(),
  ])

  return NextResponse.json({
    runs,
    total,
    page,
    pageSize,
  })
}

// POST /api/scraping/runs - Create new run
export async function POST(request: NextRequest) {
  try {
    const body: CreateRunParams = await request.json()

    const run = await createScrapingRun(body)

    return NextResponse.json(run, { status: 201 })
  } catch (error) {
    console.error('Failed to create run:', error)
    return NextResponse.json(
      { error: 'Failed to create run' },
      { status: 500 }
    )
  }
}
