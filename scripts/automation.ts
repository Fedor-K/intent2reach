#!/usr/bin/env npx ts-node

/**
 * LinkedIn Automation Script
 *
 * This script runs separately from the web app and handles browser automation.
 * It connects to the same database to read the action queue and update session status.
 *
 * Usage:
 *   npx ts-node scripts/automation.ts
 *
 * The script will:
 * 1. Open a visible Chrome browser window
 * 2. Navigate to LinkedIn
 * 3. Wait for you to log in manually
 * 4. Once logged in, start processing actions from the queue
 * 5. If logged out, pause and wait for you to log in again
 */

import puppeteer, { Browser, Page } from 'puppeteer-core'
import { PrismaClient, ActionType, ActionStatus } from '@prisma/client'
import path from 'path'
import os from 'os'
import fs from 'fs'

const prisma = new PrismaClient()

// Configuration
const USER_DATA_DIR = path.join(os.homedir(), '.intent2reach', 'chrome-profile')
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

// Find Chrome executable
function findChromePath(): string {
  const paths = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ],
  }

  const platform = os.platform() as 'darwin' | 'win32' | 'linux'
  const platformPaths = paths[platform] || paths.linux

  for (const p of platformPaths) {
    if (p && fs.existsSync(p)) {
      return p
    }
  }

  throw new Error('Chrome not found. Please install Google Chrome.')
}

// Random delay
async function randomDelay(minSec: number, maxSec: number): Promise<void> {
  const ms = (Math.random() * (maxSec - minSec) + minSec) * 1000
  await new Promise(resolve => setTimeout(resolve, ms))
}

// Update session status in database
async function updateSession(data: {
  isActive?: boolean
  isLoggedIn?: boolean
  isPaused?: boolean
  linkedinName?: string | null
  linkedinUrl?: string | null
}) {
  let session = await prisma.automationSession.findFirst({
    orderBy: { updatedAt: 'desc' },
  })

  if (session) {
    await prisma.automationSession.update({
      where: { id: session.id },
      data,
    })
  } else {
    await prisma.automationSession.create({
      data: {
        isActive: data.isActive ?? false,
        isLoggedIn: data.isLoggedIn ?? false,
        isPaused: data.isPaused ?? false,
        linkedinName: data.linkedinName,
        linkedinUrl: data.linkedinUrl,
      },
    })
  }
}

// Check if user is logged in
async function checkLoginStatus(page: Page): Promise<{ isLoggedIn: boolean; name: string | null; url: string | null }> {
  try {
    const url = page.url()

    // Check if on login page
    const isLoginPage = url.includes('linkedin.com/login') ||
                       url.includes('linkedin.com/checkpoint') ||
                       url.includes('linkedin.com/uas')

    if (isLoginPage) {
      return { isLoggedIn: false, name: null, url: null }
    }

    // Check if logged in by looking for profile elements
    const profileData = await page.evaluate(() => {
      const profileLink = document.querySelector('a[href*="/in/"][class*="profile"]') as HTMLAnchorElement
      const nameEl = document.querySelector('.global-nav__me-content .t-14') ||
                    document.querySelector('.feed-identity-module__member-name')
      const feed = document.querySelector('.feed-shared-update-v2')

      if (profileLink || nameEl || feed) {
        return {
          isLoggedIn: true,
          name: nameEl?.textContent?.trim() || null,
          url: profileLink?.href || null,
        }
      }

      return { isLoggedIn: false, name: null, url: null }
    })

    return profileData
  } catch (error) {
    return { isLoggedIn: false, name: null, url: null }
  }
}

// Get settings from database
async function getSettings() {
  const settings = await prisma.automationSettings.findFirst()
  return settings || {
    dailyLikeLimit: 20,
    dailyConnectLimit: 10,
    dailyMessageLimit: 10,
    dailyCommentLimit: 5,
    dailyTotalLimit: 50,
    minDelayBetweenActions: 30,
    maxDelayBetweenActions: 90,
    workingHoursStart: 9,
    workingHoursEnd: 18,
    enableRandomPauses: true,
    pauseMinMinutes: 5,
    pauseMaxMinutes: 15,
  }
}

// Get today's stats
async function getTodayStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stats = await prisma.dailyStats.findUnique({
    where: { date: today },
  })

  return stats || {
    likesCount: 0,
    connectsCount: 0,
    messagesCount: 0,
    commentsCount: 0,
    totalCount: 0,
  }
}

// Increment daily stats
async function incrementStats(actionType: ActionType) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const updateData: any = { totalCount: { increment: 1 } }
  switch (actionType) {
    case 'LIKE': updateData.likesCount = { increment: 1 }; break
    case 'CONNECT': updateData.connectsCount = { increment: 1 }; break
    case 'MESSAGE': updateData.messagesCount = { increment: 1 }; break
    case 'COMMENT': updateData.commentsCount = { increment: 1 }; break
  }

  await prisma.dailyStats.upsert({
    where: { date: today },
    create: {
      date: today,
      likesCount: actionType === 'LIKE' ? 1 : 0,
      connectsCount: actionType === 'CONNECT' ? 1 : 0,
      messagesCount: actionType === 'MESSAGE' ? 1 : 0,
      commentsCount: actionType === 'COMMENT' ? 1 : 0,
      totalCount: 1,
    },
    update: updateData,
  })
}

// Check if within working hours
function isWithinWorkingHours(settings: any): boolean {
  const hour = new Date().getHours()
  return hour >= settings.workingHoursStart && hour < settings.workingHoursEnd
}

// Get next action from queue
async function getNextAction(settings: any, todayStats: any) {
  const actionTypes: ActionType[] = []

  if (todayStats.likesCount < settings.dailyLikeLimit) actionTypes.push('LIKE')
  if (todayStats.connectsCount < settings.dailyConnectLimit) actionTypes.push('CONNECT')
  if (todayStats.messagesCount < settings.dailyMessageLimit) actionTypes.push('MESSAGE')
  if (todayStats.commentsCount < settings.dailyCommentLimit) actionTypes.push('COMMENT')
  actionTypes.push('PROFILE_VIEW')

  if (actionTypes.length === 0) return null

  return prisma.actionQueue.findFirst({
    where: {
      status: 'PENDING',
      actionType: { in: actionTypes },
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: new Date() } },
      ],
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  })
}

// Human-like scroll
async function humanScroll(page: Page) {
  await page.evaluate(() => {
    const scrollAmount = Math.floor(Math.random() * 300) + 100
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' })
  })
  await randomDelay(0.5, 1.5)
}

// Execute LIKE action
async function executeLike(page: Page, targetUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`  Navigating to: ${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'networkidle2' })
    await randomDelay(2, 4)
    await humanScroll(page)

    const likeSelectors = [
      'button[aria-label*="Like"]',
      'button.react-button__trigger[aria-label*="React Like"]',
      '.feed-shared-social-action-bar__action-button[aria-label*="Like"]',
    ]

    for (const selector of likeSelectors) {
      const btn = await page.$(selector)
      if (btn) {
        const ariaPressed = await page.evaluate(el => el.getAttribute('aria-pressed'), btn)
        if (ariaPressed === 'true') {
          console.log('  Already liked')
          return { success: true }
        }

        const box = await btn.boundingBox()
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
        }
        await randomDelay(0.2, 0.5)
        await btn.click()
        await randomDelay(1, 3)
        console.log('  Liked successfully')
        return { success: true }
      }
    }

    return { success: false, error: 'Like button not found' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Execute CONNECT action
async function executeConnect(page: Page, targetUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`  Navigating to: ${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'networkidle2' })
    await randomDelay(2, 4)
    await humanScroll(page)

    const connectSelectors = [
      'button[aria-label*="Connect"]',
      'button.pvs-profile-actions__action[aria-label*="Connect"]',
    ]

    let btn = null
    for (const selector of connectSelectors) {
      btn = await page.$(selector)
      if (btn) break
    }

    if (!btn) {
      const moreBtn = await page.$('button[aria-label="More actions"]')
      if (moreBtn) {
        await moreBtn.click()
        await randomDelay(0.5, 1)
        btn = await page.$('button[aria-label*="Connect"]')
      }
    }

    if (!btn) {
      return { success: false, error: 'Connect button not found' }
    }

    await btn.click()
    await randomDelay(1, 2)

    // Click Send without note for now
    const sendBtn = await page.$('button[aria-label="Send now"]') ||
                    await page.$('button[aria-label="Send invitation"]') ||
                    await page.$('button[aria-label="Send without a note"]')
    if (sendBtn) {
      await sendBtn.click()
      await randomDelay(1, 2)
    }

    console.log('  Connection request sent')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Execute PROFILE_VIEW action
async function executeProfileView(page: Page, targetUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`  Viewing profile: ${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'networkidle2' })
    await randomDelay(3, 6)

    for (let i = 0; i < 3; i++) {
      await humanScroll(page)
      await randomDelay(1, 3)
    }

    console.log('  Profile viewed')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Main automation loop
async function main() {
  console.log('🚀 LinkedIn Automation Script')
  console.log('============================\n')

  // Ensure user data directory exists
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true })
  }

  const chromePath = findChromePath()
  console.log(`Using Chrome: ${chromePath}`)
  console.log(`User data: ${USER_DATA_DIR}\n`)

  // Launch browser
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-sandbox',
    ],
  })

  const pages = await browser.pages()
  const page = pages[0] || await browser.newPage()

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )

  // Navigate to LinkedIn
  console.log('Navigating to LinkedIn...\n')
  await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: 60000 })

  // Update session as active
  await updateSession({ isActive: true, isLoggedIn: false })

  let isLoggedIn = false
  let actionsSinceLastPause = 0
  const pauseAfterActions = Math.floor(Math.random() * 6) + 5

  // Handle browser close
  browser.on('disconnected', async () => {
    console.log('\n🔴 Browser closed')
    await updateSession({ isActive: false, isLoggedIn: false })
    await prisma.$disconnect()
    process.exit(0)
  })

  // Main loop
  console.log('⏳ Waiting for login...')
  console.log('   Please log in to LinkedIn in the browser window\n')

  while (true) {
    try {
      // Check login status
      const loginStatus = await checkLoginStatus(page)

      if (loginStatus.isLoggedIn && !isLoggedIn) {
        console.log(`✅ Logged in as: ${loginStatus.name || 'Unknown'}`)
        isLoggedIn = true
        await updateSession({
          isLoggedIn: true,
          linkedinName: loginStatus.name,
          linkedinUrl: loginStatus.url,
        })
      } else if (!loginStatus.isLoggedIn && isLoggedIn) {
        console.log('⚠️  Logged out! Please log in again.')
        isLoggedIn = false
        await updateSession({ isLoggedIn: false })
      }

      // If not logged in, wait
      if (!isLoggedIn) {
        await randomDelay(5, 10)
        continue
      }

      // Check if paused
      const session = await prisma.automationSession.findFirst({
        orderBy: { updatedAt: 'desc' },
      })
      if (session?.isPaused) {
        console.log('⏸️  Paused. Resume from web dashboard.')
        await randomDelay(5, 10)
        continue
      }

      // Get settings
      const settings = await getSettings()

      // Check working hours
      if (!isWithinWorkingHours(settings)) {
        console.log(`⏰ Outside working hours (${settings.workingHoursStart}:00 - ${settings.workingHoursEnd}:00)`)
        await randomDelay(60, 120)
        continue
      }

      // Check daily limits
      const todayStats = await getTodayStats()
      if (todayStats.totalCount >= settings.dailyTotalLimit) {
        console.log(`📊 Daily limit reached (${todayStats.totalCount}/${settings.dailyTotalLimit})`)
        await randomDelay(300, 600)
        continue
      }

      // Random pause
      if (settings.enableRandomPauses && actionsSinceLastPause >= pauseAfterActions) {
        const pauseMin = Math.floor(Math.random() * (settings.pauseMaxMinutes - settings.pauseMinMinutes + 1)) + settings.pauseMinMinutes
        console.log(`☕ Taking a ${pauseMin} minute break...`)
        await randomDelay(pauseMin * 60, pauseMin * 60)
        actionsSinceLastPause = 0
        continue
      }

      // Get next action
      const action = await getNextAction(settings, todayStats)
      if (!action) {
        console.log('📭 No actions in queue')
        await randomDelay(30, 60)
        continue
      }

      // Execute action
      console.log(`\n🎯 Executing: ${action.actionType}`)
      console.log(`   Target: ${action.targetName || action.targetUrl}`)

      await prisma.actionQueue.update({
        where: { id: action.id },
        data: {
          status: 'IN_PROGRESS',
          lastAttemptAt: new Date(),
          attempts: action.attempts + 1,
        },
      })

      let result: { success: boolean; error?: string } = { success: false, error: 'Unknown action type' }

      switch (action.actionType) {
        case 'LIKE':
          result = await executeLike(page, action.targetUrl)
          break
        case 'CONNECT':
          result = await executeConnect(page, action.targetUrl)
          break
        case 'PROFILE_VIEW':
          result = await executeProfileView(page, action.targetUrl)
          break
        case 'MESSAGE':
        case 'COMMENT':
          result = { success: false, error: 'Not implemented yet' }
          break
      }

      // Update action status
      if (result.success) {
        await prisma.actionQueue.update({
          where: { id: action.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        await incrementStats(action.actionType)
        actionsSinceLastPause++
        console.log(`   ✅ Success`)
      } else {
        const shouldRetry = action.attempts < 3
        await prisma.actionQueue.update({
          where: { id: action.id },
          data: {
            status: shouldRetry ? 'PENDING' : 'FAILED',
            errorMessage: result.error,
          },
        })
        console.log(`   ❌ Failed: ${result.error}`)
      }

      // Delay before next action
      const delay = Math.floor(Math.random() * (settings.maxDelayBetweenActions - settings.minDelayBetweenActions + 1)) + settings.minDelayBetweenActions
      console.log(`   ⏱️  Next action in ${delay} seconds`)
      await randomDelay(delay, delay)

    } catch (error) {
      console.error('Error in main loop:', error)
      await randomDelay(30, 60)
    }
  }
}

// Run
main().catch(async (error) => {
  console.error('Fatal error:', error)
  await updateSession({ isActive: false })
  await prisma.$disconnect()
  process.exit(1)
})
