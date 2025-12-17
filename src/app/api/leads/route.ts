import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const engagementType = searchParams.get('engagementType') || null
    const search = searchParams.get('search') || null

    const skip = (page - 1) * pageSize

    // Build where clause
    const where: any = {}

    if (engagementType) {
      where.engagementTypes = {
        has: engagementType,
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get total count
    const total = await prisma.lead.count({ where })

    // Get leads
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip,
      take: pageSize,
    })

    return NextResponse.json({
      leads,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('Failed to fetch leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'Invalid request: ids array required' },
        { status: 400 }
      )
    }

    await prisma.lead.deleteMany({
      where: {
        id: { in: ids },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete leads:', error)
    return NextResponse.json(
      { error: 'Failed to delete leads' },
      { status: 500 }
    )
  }
}
