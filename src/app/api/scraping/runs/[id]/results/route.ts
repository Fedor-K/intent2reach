import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/scraping/runs/[id]/results - Get run results
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  const skip = (page - 1) * pageSize

  // Check if run exists
  const run = await prisma.scrapingRun.findUnique({
    where: { id },
  })

  if (!run) {
    return NextResponse.json(
      { error: 'Run not found' },
      { status: 404 }
    )
  }

  const [results, total] = await Promise.all([
    prisma.scrapingResult.findMany({
      where: { runId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.scrapingResult.count({
      where: { runId: id },
    }),
  ])

  return NextResponse.json({
    results,
    total,
    page,
    pageSize,
  })
}
