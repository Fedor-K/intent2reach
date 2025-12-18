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

// Human-like mouse movement using Bezier curves
async function humanMouseMove(page: Page, targetX: number, targetY: number): Promise<void> {
  // Get current mouse position (start from random position if first move)
  const startX = Math.random() * 800 + 100
  const startY = Math.random() * 400 + 100

  // Generate control points for Bezier curve (creates natural arc)
  const cp1x = startX + (targetX - startX) * 0.3 + (Math.random() - 0.5) * 100
  const cp1y = startY + (targetY - startY) * 0.1 + (Math.random() - 0.5) * 100
  const cp2x = startX + (targetX - startX) * 0.7 + (Math.random() - 0.5) * 100
  const cp2y = startY + (targetY - startY) * 0.9 + (Math.random() - 0.5) * 100

  // Number of steps (more steps = smoother movement)
  const steps = 20 + Math.floor(Math.random() * 15)

  for (let i = 0; i <= steps; i++) {
    const t = i / steps

    // Cubic Bezier formula
    const x = Math.pow(1 - t, 3) * startX +
              3 * Math.pow(1 - t, 2) * t * cp1x +
              3 * (1 - t) * Math.pow(t, 2) * cp2x +
              Math.pow(t, 3) * targetX

    const y = Math.pow(1 - t, 3) * startY +
              3 * Math.pow(1 - t, 2) * t * cp1y +
              3 * (1 - t) * Math.pow(t, 2) * cp2y +
              Math.pow(t, 3) * targetY

    await page.mouse.move(x, y)

    // Variable delay between movements (faster in middle, slower at start/end)
    const speedFactor = Math.sin(t * Math.PI) * 0.5 + 0.5
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10 * speedFactor))
  }

  // Small random offset on final position (humans don't click exactly center)
  const finalX = targetX + (Math.random() - 0.5) * 6
  const finalY = targetY + (Math.random() - 0.5) * 6
  await page.mouse.move(finalX, finalY)
}

// Human-like click with mouse movement
async function humanClick(page: Page, x: number, y: number): Promise<void> {
  await humanMouseMove(page, x, y)
  await randomDelay(0.1, 0.3) // Small pause before click
  await page.mouse.down()
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100)) // Hold duration
  await page.mouse.up()
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
    case 'CONNECT_NO_NOTE': updateData.connectsCount = { increment: 1 }; break
    case 'MESSAGE': updateData.messagesCount = { increment: 1 }; break
    case 'MESSAGE1': updateData.messagesCount = { increment: 1 }; break
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
  if (todayStats.connectsCount < settings.dailyConnectLimit) {
    actionTypes.push('CONNECT')
    actionTypes.push('CONNECT_NO_NOTE')
  }
  if (todayStats.messagesCount < settings.dailyMessageLimit) {
    actionTypes.push('MESSAGE')
    actionTypes.push('MESSAGE1')
  }
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
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
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
          await humanClick(page, box.x + box.width / 2, box.y + box.height / 2)
        } else {
          await btn.click() // Fallback if no bounding box
        }
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
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await randomDelay(3, 5) // Wait longer for profile to load

    // Verify we're on the profile page (not redirected somewhere else)
    const currentUrl = page.url()
    console.log(`  Current URL: ${currentUrl}`)
    if (!currentUrl.includes('/in/')) {
      // Try to navigate again
      console.log('  Not on profile page, retrying navigation...')
      await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 })
      await randomDelay(2, 3)
      const retryUrl = page.url()
      if (!retryUrl.includes('/in/')) {
        return { success: false, error: `Redirected to wrong page: ${retryUrl}` }
      }
    }

    await humanScroll(page)

    // Wait for profile actions to appear
    await page.waitForSelector('button', { timeout: 10000 }).catch(() => {})

    // Helper function to handle connection modal
    const handleConnectionModal = async (): Promise<boolean> => {
      await randomDelay(1, 2)
      const sendSelectors = [
        'button[aria-label="Send without a note"]',
        'button[aria-label="Send now"]',
        'button[aria-label="Send invitation"]',
        'button[aria-label="Send"]',
      ]
      for (const selector of sendSelectors) {
        const sendBtn = await page.$(selector)
        if (sendBtn) {
          const box = await sendBtn.boundingBox()
          if (box) {
            await humanClick(page, box.x + box.width / 2, box.y + box.height / 2)
          } else {
            await sendBtn.click()
          }
          await randomDelay(1, 2)
          return true
        }
      }
      return false
    }

    // First, check what buttons are visible on the profile (not header - y > 200)
    const buttonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const result = {
        hasFollowButton: false,
        hasFollowingButton: false,
        hasConnectButton: false,
        hasMessageButton: false,
        hasPendingButton: false,
        hasMoreButton: false,
      }

      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect()
        // Skip buttons in header area (y < 200) or invisible buttons
        if (rect.y < 200 || rect.width === 0 || rect.height === 0) continue

        const text = btn.textContent?.trim() || ''
        const ariaLabel = btn.getAttribute('aria-label') || ''

        // Check for Follow button (not Following - that means already following)
        if ((text === 'Follow' || text === '+ Follow') && text !== 'Following') {
          result.hasFollowButton = true
        }
        // Check for Following button (already following this person)
        if (text === 'Following' || text.includes('✓ Following') || text.includes('✔ Following')) {
          result.hasFollowingButton = true
        }
        // Check for Connect button
        if ((text === 'Connect' || ariaLabel.includes('Invite') && ariaLabel.includes('connect')) &&
            !text.includes('Follow') && !ariaLabel.includes('Follow')) {
          result.hasConnectButton = true
        }
        // Check for Message (already connected)
        if (text === 'Message' || ariaLabel.includes('Message')) {
          result.hasMessageButton = true
        }
        // Check for Pending (already sent request)
        if (text === 'Pending' || ariaLabel.includes('Pending')) {
          result.hasPendingButton = true
        }
        // Check for More button
        if (text === 'More' || ariaLabel === 'More actions') {
          result.hasMoreButton = true
        }
      }

      return result
    })

    console.log(`  Profile buttons: Follow=${buttonInfo.hasFollowButton}, Following=${buttonInfo.hasFollowingButton}, Connect=${buttonInfo.hasConnectButton}, Message=${buttonInfo.hasMessageButton}, Pending=${buttonInfo.hasPendingButton}, More=${buttonInfo.hasMoreButton}`)

    // Check if pending (already sent request)
    if (buttonInfo.hasPendingButton) {
      return { success: false, error: 'Connection request already pending' }
    }

    // Note: Message button doesn't mean connected - could be InMail or group member
    // Only skip if Message is present AND no More button AND no Follow/Following (truly connected profiles)
    if (buttonInfo.hasMessageButton && !buttonInfo.hasMoreButton && !buttonInfo.hasFollowButton && !buttonInfo.hasFollowingButton && !buttonInfo.hasConnectButton) {
      return { success: false, error: 'Already connected (no Connect option available)' }
    }

    // Helper function to click Connect in More dropdown using real mouse coordinates
    const clickConnectInDropdown = async (): Promise<boolean> => {
      // Find and click More button - must be in profile actions area (y > 200 to skip header)
      const moreBtnBox = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        // Find More button that's in the profile section (not header)
        const moreBtn = buttons.find(b => {
          const text = b.textContent?.trim() || ''
          const ariaLabel = b.getAttribute('aria-label') || ''
          const rect = b.getBoundingClientRect()
          // Must be "More" button AND below the header (y > 200) AND visible
          return (text === 'More' || ariaLabel === 'More actions') &&
                 rect.y > 200 && rect.width > 0 && rect.height > 0
        })
        if (moreBtn) {
          const rect = moreBtn.getBoundingClientRect()
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        }
        return null
      })

      if (!moreBtnBox) {
        console.log('  More button not found')
        return false
      }

      // Click More button using real mouse click
      console.log(`  Clicking More button at (${moreBtnBox.x}, ${moreBtnBox.y})`)
      await humanClick(page, moreBtnBox.x, moreBtnBox.y)
      await randomDelay(1.5, 2.5) // Wait for dropdown animation

      // Wait for dropdown to appear - try multiple selectors
      await page.waitForSelector('.artdeco-dropdown__content, [role="menu"], .pvs-overflow-actions-dropdown__content', { timeout: 5000 }).catch(() => {})
      await randomDelay(0.5, 1)

      // Get dropdown content for debugging
      const dropdownInfo = await page.evaluate(() => {
        // Try multiple dropdown selectors
        const dropdownSelectors = [
          '.artdeco-dropdown__content',
          '[role="menu"]',
          '.pvs-overflow-actions-dropdown__content',
          '.artdeco-dropdown__content-inner'
        ]

        let dropdown: Element | null = null
        for (const sel of dropdownSelectors) {
          dropdown = document.querySelector(sel)
          if (dropdown) break
        }

        if (!dropdown) return { found: false, content: 'No dropdown found', connectBox: null, allText: '' }

        const allText = dropdown.textContent || ''

        // Method 1: Look for Connect in aria-label
        const connectByAria = dropdown.querySelector('[aria-label*="Connect"], [aria-label*="connect"]') as HTMLElement
        if (connectByAria) {
          const rect = connectByAria.getBoundingClientRect()
          return {
            found: true,
            content: allText.substring(0, 200),
            connectBox: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            allText: allText.substring(0, 500)
          }
        }

        // Method 2: Look for dropdown items containing Connect
        const menuItems = dropdown.querySelectorAll('[role="menuitem"], .artdeco-dropdown__item, li, div[data-control-name]')
        for (const item of menuItems) {
          const text = item.textContent?.trim() || ''
          if (text === 'Connect' || text.startsWith('Connect\n') || text.includes('Connect')) {
            // Make sure it's actually Connect, not "Connected" or similar
            if (!text.includes('Connected') && !text.includes('Connecting')) {
              const rect = (item as HTMLElement).getBoundingClientRect()
              if (rect.width > 0 && rect.height > 0) {
                return {
                  found: true,
                  content: allText.substring(0, 200),
                  connectBox: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
                  allText: allText.substring(0, 500)
                }
              }
            }
          }
        }

        // Method 3: Find any element with exactly "Connect" text
        const allElements = dropdown.querySelectorAll('*')
        for (const el of allElements) {
          // Check direct text content
          for (const child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim() === 'Connect') {
              const rect = (el as HTMLElement).getBoundingClientRect()
              if (rect.width > 0 && rect.height > 0) {
                // Get clickable parent
                const clickable = (el as HTMLElement).closest('button, a, [role="menuitem"], li, div[tabindex]') as HTMLElement || el as HTMLElement
                const clickRect = clickable.getBoundingClientRect()
                return {
                  found: true,
                  content: allText.substring(0, 200),
                  connectBox: { x: clickRect.x + clickRect.width / 2, y: clickRect.y + clickRect.height / 2 },
                  allText: allText.substring(0, 500)
                }
              }
            }
          }
        }

        return { found: false, content: allText.substring(0, 200), connectBox: null, allText: allText.substring(0, 500) }
      })

      console.log(`  Dropdown content: ${dropdownInfo.allText || dropdownInfo.content}`)

      if (!dropdownInfo.connectBox) {
        console.log('  Connect not found in dropdown')
        await page.keyboard.press('Escape')
        return false
      }

      // Click Connect using real mouse coordinates
      console.log(`  Clicking Connect at (${dropdownInfo.connectBox.x}, ${dropdownInfo.connectBox.y})`)
      await humanClick(page, dropdownInfo.connectBox.x, dropdownInfo.connectBox.y)
      await randomDelay(1, 2)
      return true
    }

    // Strategy 1: If Follow or Following is visible, Connect is likely in More dropdown
    if ((buttonInfo.hasFollowButton || buttonInfo.hasFollowingButton) && buttonInfo.hasMoreButton) {
      console.log('  Follow/Following is visible, checking More dropdown for Connect...')

      const connectClicked = await clickConnectInDropdown()
      if (connectClicked) {
        await handleConnectionModal()
        console.log('  Connection request sent')
        return { success: true }
      }
    }

    // Strategy 2: Try to find and click Connect button directly
    if (buttonInfo.hasConnectButton) {
      console.log('  Found Connect button, clicking directly...')

      // Get Connect button coordinates for human-like click
      const connectBtnBox = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const connectBtn = buttons.find(b => {
          const text = b.textContent?.trim() || ''
          const ariaLabel = b.getAttribute('aria-label') || ''
          const rect = b.getBoundingClientRect()
          // Must be exactly "Connect", not contain Follow, and be in main content area (y > 200)
          return (text === 'Connect' || (ariaLabel.includes('Invite') && ariaLabel.includes('connect'))) &&
                 !text.includes('Follow') && !ariaLabel.includes('Follow') &&
                 rect.y > 200
        })
        if (connectBtn) {
          const rect = connectBtn.getBoundingClientRect()
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        }
        return null
      })

      if (connectBtnBox) {
        await humanClick(page, connectBtnBox.x, connectBtnBox.y)
        console.log('  Clicked Connect button')
        await handleConnectionModal()
        console.log('  Connection request sent')
        return { success: true }
      }
    }

    // Strategy 3: Fallback - try More dropdown anyway
    if (buttonInfo.hasMoreButton) {
      console.log('  Trying More dropdown as fallback...')
      const connectClicked = await clickConnectInDropdown()
      if (connectClicked) {
        await handleConnectionModal()
        console.log('  Connection request sent (fallback)')
        return { success: true }
      }
    }

    return { success: false, error: 'Connect button not found in any location' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Execute PROFILE_VIEW action
async function executeProfileView(page: Page, targetUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`  Viewing profile: ${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
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

// Execute CONNECT_NO_NOTE action (simplified connect without note)
async function executeConnectNoNote(page: Page, targetUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`  Navigating to: ${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await randomDelay(2, 4)

    // Verify we're on profile page
    const currentUrl = page.url()
    if (!currentUrl.includes('/in/')) {
      return { success: false, error: `Not a profile page: ${currentUrl}` }
    }

    await humanScroll(page)
    await page.waitForSelector('button', { timeout: 10000 }).catch(() => {})

    // Look for Connect button
    const connectBtnBox = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || ''
        const ariaLabel = btn.getAttribute('aria-label') || ''
        const rect = btn.getBoundingClientRect()

        // Skip header buttons
        if (rect.y < 200) continue

        // Check for Connect
        if (text === 'Connect' || ariaLabel.includes('Invite') && ariaLabel.includes('connect')) {
          if (!text.includes('Follow') && !ariaLabel.includes('Follow')) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
          }
        }
      }

      // Check if already connected or pending
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || ''
        if (text === 'Pending' || text === 'Message') {
          return { alreadyConnected: true }
        }
      }

      return null
    })

    if (!connectBtnBox) {
      // Try More dropdown
      const moreBtnBox = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        for (const btn of buttons) {
          const ariaLabel = btn.getAttribute('aria-label') || ''
          const rect = btn.getBoundingClientRect()
          if (rect.y > 200 && ariaLabel.toLowerCase().includes('more')) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
          }
        }
        return null
      })

      if (moreBtnBox) {
        await humanClick(page, moreBtnBox.x, moreBtnBox.y)
        await randomDelay(1, 2)

        // Look for Connect in dropdown
        const dropdownConnect = await page.evaluate(() => {
          const items = document.querySelectorAll('[role="menuitem"], .artdeco-dropdown__item')
          for (const item of items) {
            if (item.textContent?.includes('Connect')) {
              const rect = (item as HTMLElement).getBoundingClientRect()
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
            }
          }
          return null
        })

        if (dropdownConnect) {
          await humanClick(page, dropdownConnect.x, dropdownConnect.y)
          await randomDelay(1, 2)
        } else {
          await page.keyboard.press('Escape')
          return { success: false, error: 'Connect not found in dropdown' }
        }
      } else {
        return { success: false, error: 'Connect button not found' }
      }
    } else if ('alreadyConnected' in connectBtnBox) {
      console.log('  Already connected or pending')
      return { success: true }
    } else {
      await humanClick(page, connectBtnBox.x, connectBtnBox.y)
      await randomDelay(1, 2)
    }

    // Handle connection modal - click "Send without a note"
    const sendSelectors = [
      'button[aria-label="Send without a note"]',
      'button[aria-label="Send now"]',
      'button[aria-label="Send invitation"]',
      'button[aria-label="Send"]',
    ]

    // Wait for modal to appear
    await randomDelay(1.5, 2.5)

    // First try aria-label selectors
    for (const selector of sendSelectors) {
      const sendBtn = await page.$(selector)
      if (sendBtn) {
        const box = await sendBtn.boundingBox()
        if (box) {
          await humanClick(page, box.x + box.width / 2, box.y + box.height / 2)
        } else {
          await sendBtn.click()
        }
        await randomDelay(1, 2)
        console.log('  Connection request sent (no note)')
        return { success: true }
      }
    }

    // Try finding button by text content in modal
    const sendBtnByText = await page.evaluate(() => {
      // Look for modal
      const modal = document.querySelector('[role="dialog"], .artdeco-modal, .send-invite')
      const searchArea = modal || document

      const buttons = Array.from(searchArea.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase() || ''
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || ''

        if (text.includes('send') && !text.includes('add a note') ||
            ariaLabel.includes('send') && !ariaLabel.includes('note')) {
          const rect = btn.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
          }
        }
      }
      return null
    })

    if (sendBtnByText) {
      await humanClick(page, sendBtnByText.x, sendBtnByText.y)
      await randomDelay(1, 2)
      console.log('  Connection request sent (no note)')
      return { success: true }
    }

    // Check if modal appeared but we couldn't find send button
    const hasModal = await page.$('[role="dialog"], .artdeco-modal')
    if (hasModal) {
      // Modal is there but couldn't find button - close it
      await page.keyboard.press('Escape')
      return { success: false, error: 'Modal appeared but Send button not found' }
    }

    // No modal appeared - maybe already connected or request already pending
    const currentButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return buttons.map(b => b.textContent?.trim()).filter(t => t)
    })

    if (currentButtons.some(t => t === 'Pending' || t === 'Message')) {
      console.log('  Already connected or pending')
      return { success: true }
    }

    return { success: false, error: 'Could not complete connection request' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Execute MESSAGE action (send DM to connected user)
async function executeMessage(page: Page, targetUrl: string, messageText: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!messageText) {
      return { success: false, error: 'No message text provided' }
    }

    console.log(`  Navigating to: ${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await randomDelay(2, 4)

    // Verify we're on profile page
    const currentUrl = page.url()
    if (!currentUrl.includes('/in/')) {
      return { success: false, error: `Not a profile page: ${currentUrl}` }
    }

    await humanScroll(page)

    // Look for Message button
    const messageBtnBox = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || ''
        const rect = btn.getBoundingClientRect()

        // Skip header buttons
        if (rect.y < 200) continue

        if (text === 'Message') {
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        }
      }
      return null
    })

    if (!messageBtnBox) {
      return { success: false, error: 'Message button not found (not connected?)' }
    }

    await humanClick(page, messageBtnBox.x, messageBtnBox.y)
    await randomDelay(2, 3)

    // Wait for message modal/composer to appear
    await page.waitForSelector('.msg-form__contenteditable, [role="textbox"]', { timeout: 10000 })
    await randomDelay(0.5, 1)

    // Type the message
    const textArea = await page.$('.msg-form__contenteditable, [role="textbox"]')
    if (!textArea) {
      return { success: false, error: 'Message textbox not found' }
    }

    await textArea.click()
    await randomDelay(0.3, 0.6)

    // Type message character by character (more human-like)
    for (const char of messageText) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 50 })
    }

    await randomDelay(1, 2)

    // Click Send button
    const sendBtnBox = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || ''
        const ariaLabel = btn.getAttribute('aria-label') || ''
        if (text === 'Send' || ariaLabel.toLowerCase().includes('send')) {
          const rect = btn.getBoundingClientRect()
          // Make sure it's visible (in message composer)
          if (rect.width > 0 && rect.height > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
          }
        }
      }
      return null
    })

    if (!sendBtnBox) {
      return { success: false, error: 'Send button not found' }
    }

    await humanClick(page, sendBtnBox.x, sendBtnBox.y)
    await randomDelay(1, 2)

    // Close message window
    await page.keyboard.press('Escape')
    await randomDelay(0.5, 1)

    console.log('  Message sent')
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
        case 'CONNECT_NO_NOTE':
          result = await executeConnectNoNote(page, action.targetUrl)
          break
        case 'PROFILE_VIEW':
          result = await executeProfileView(page, action.targetUrl)
          break
        case 'MESSAGE':
          result = { success: false, error: 'Not implemented yet' }
          break
        case 'MESSAGE1':
          result = await executeMessage(page, action.targetUrl, action.messageText || '')
          break
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
