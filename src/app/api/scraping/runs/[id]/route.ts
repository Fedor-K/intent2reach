import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/scraping/runs/[id] - Get single run
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)

  const run = await prisma.scrapingRun.findUnique({
    where: { id },
  })

  if (!run) {
    return NextResponse.json(
      { error: 'Run not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(run)
}
