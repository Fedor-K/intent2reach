import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/engagements - List engagements with filters
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const search = searchParams.get('search') || ''
  const engagementType = searchParams.get('engagementType') || ''
  const sortBy = searchParams.get('sortBy') || 'createdAt' // createdAt, engagedAt, personName
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  const where: any = {}

  // Search by person name, position, post author, keyword, or comment text
  if (search) {
    where.OR = [
      { personName: { contains: search, mode: 'insensitive' } },
      { personPosition: { contains: search, mode: 'insensitive' } },
      { postAuthorName: { contains: search, mode: 'insensitive' } },
      { searchQuery: { contains: search, mode: 'insensitive' } },
      { commentText: { contains: search, mode: 'insensitive' } },
      { postText: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Filter by engagement type
  if (engagementType) {
    where.engagementType = engagementType
  }

  const [engagements, total] = await Promise.all([
    prisma.engagement.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.engagement.count({ where }),
  ])

  return NextResponse.json({
    engagements,
    total,
    page,
    pageSize,
  })
}

// DELETE /api/engagements - Delete selected engagements
export async function DELETE(request: NextRequest) {
  const { ids } = await request.json()

  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  await prisma.engagement.deleteMany({
    where: { id: { in: ids } },
  })

  return NextResponse.json({ success: true, deleted: ids.length })
}
