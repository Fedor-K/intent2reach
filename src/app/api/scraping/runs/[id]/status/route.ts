import { NextRequest, NextResponse } from 'next/server'
import { checkRunStatus } from '@/lib/apify'

// GET /api/scraping/runs/[id]/status - Check and update run status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)

  try {
    const run = await checkRunStatus(id)

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(run)
  } catch (error) {
    console.error('Failed to check status:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
