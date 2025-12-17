import { NextRequest, NextResponse } from 'next/server'
import { abortRun } from '@/lib/apify'

// POST /api/scraping/runs/[id]/abort - Abort a running actor
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)

  try {
    const run = await abortRun(id)

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(run)
  } catch (error) {
    console.error('Failed to abort run:', error)
    return NextResponse.json(
      { error: 'Failed to abort run' },
      { status: 500 }
    )
  }
}
