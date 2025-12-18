# Intent2Reach - LinkedIn Intelligence Platform

LinkedIn scraping and outreach automation platform. Сбор постов, комментариев, реакций и автоматизация LinkedIn outreach.

## Production

- **URL**: https://intenttoreach.com
- **Server IP**: 198.12.73.168 (RackNerd VPS)
- **Branch**: `claude/apify-actor-service-eDOKE`
- **Server Path**: `/var/www/intent2reach`

### Deploy to Server
```bash
ssh root@198.12.73.168
cd /var/www/intent2reach
git pull origin claude/apify-actor-service-eDOKE
npm install
npx prisma db push    # if schema changed
npm run build
pm2 restart all
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Scraping**: Apify Actor
- **Browser Automation**: Puppeteer-core
- **Process Manager**: PM2

## Features

### 1. Scraping Tab
- Create scraping runs with keywords, LinkedIn URLs, company filters
- Time period filtering (24h, week, month, etc.)
- Scrape comments and reactions
- View results with expandable rows (reactions, comments)
- Repeat previous runs with same parameters

### 2. Activity Feed Tab
- Individual engagement tracking (who liked/commented what)
- Filter by action type (Comments, Likes, Empathy, etc.)
- Search by name, position, keyword, comment text
- Queue actions for automation (Like, Connect)
- Export to CSV

### 3. Automation Tab

#### Browser & Queue
- **Human-like LinkedIn automation** with random delays and mouse movements
- Runs as separate script with visible browser
- Supported actions: Like, Connect, Profile View, Message
- Safety features:
  - Daily limits per action type
  - Working hours with AM/PM selector
  - Random pauses every 5-10 actions
  - Bezier curve mouse movements (human-like)

#### Outreach Campaigns (NEW)
- **Campaign-based outreach management**
- Create campaigns with:
  - Message template with variables (`{{firstName}}`, `{{landingUrl}}`)
  - Daily invite/message limits
  - Working hours
- **Import leads** from scraping runs (commenters + reactors)
- **Manual lead scoring**: HOT / WARM temperature
- **Lead status tracking**: NEW → INVITED → CONNECTED → MSG1 → DONE
- **Mass actions**:
  - "Queue CONNECT (HOT first)" - prioritize hot leads
  - "Queue CONNECT (all NEW)"
  - "Queue MESSAGE1 (CONNECTED)" - send first message to connected leads

### 4. API Endpoints

**Scraping:**
- `GET/POST /api/scraping/runs` - List/create runs
- `GET /api/scraping/runs/[id]/results` - Get results
- `POST /api/scraping/runs/[id]/abort` - Stop run

**Activity Feed:**
- `GET /api/engagements` - List engagements
- `POST /api/engagements/backfill` - Extract from results

**Automation:**
- `GET/POST /api/automation/session` - Session status
- `GET/POST/DELETE /api/automation/queue` - Action queue
- `GET/PUT /api/automation/settings` - Settings

**Campaigns:**
- `GET/POST /api/campaigns` - List/create campaigns
- `GET/PUT/DELETE /api/campaigns/[id]` - Campaign CRUD
- `GET/POST/PUT /api/campaigns/[id]/leads` - Campaign leads
- `POST /api/campaigns/[id]/leads/queue` - Queue actions for leads

## Database Schema

```prisma
// Scraping
model ScrapingRun { ... }
model ScrapingResult { ... }

// Activity Feed
model Engagement { ... }
model Lead { ... }

// Automation
model AutomationSession { ... }
model AutomationSettings { ... }
model ActionQueue {
  actionType  ActionType  // LIKE, CONNECT, CONNECT_NO_NOTE, MESSAGE, MESSAGE1, COMMENT, PROFILE_VIEW
  status      ActionStatus
  targetUrl   String
  messageText String?     // For MESSAGE1
  campaignId  Int?        // Link to campaign
  campaignLeadId Int?     // Link to campaign lead
  ...
}
model DailyStats { ... }

// Campaigns
model Campaign {
  name              String
  message1Template  String?   // Supports {{firstName}}, {{landingUrl}}
  landingUrl        String?
  invitesPerDay     Int
  messagesPerDay    Int
  workingHoursStart Int
  workingHoursEnd   Int
  isActive          Boolean
  leads             CampaignLead[]
}

model CampaignLead {
  profileUrl    String
  name          String
  firstName     String?
  headline      String?
  temperature   LeadTemperature  // HOT, WARM
  status        LeadStatus       // NEW, INVITED, CONNECTED, MSG1, DONE
  notes         String?
  campaign      Campaign
}
```

## Running Automation

The automation runs as a **separate script** that opens a visible Chrome browser.

### On Mac (recommended)

```bash
# Clone and setup
git clone https://github.com/Fedor-K/intent2reach.git
cd intent2reach
npm install

# Create .env with database URL
echo 'DATABASE_URL="postgresql://..."' > .env

# Generate Prisma client
npx prisma generate

# Run automation
npx tsx scripts/automation.ts
```

### How it works

1. Script opens Chrome with persistent profile
2. Navigates to LinkedIn
3. **You log in manually** (credentials never stored)
4. Script detects login and starts processing queue
5. Actions are queued from web dashboard

### Action Types

| Action | Description |
|--------|-------------|
| `LIKE` | Like a post |
| `CONNECT` | Send connection with note option |
| `CONNECT_NO_NOTE` | Send connection without note (for campaigns) |
| `MESSAGE1` | Send first message from campaign template |
| `PROFILE_VIEW` | View profile |

### Safety Features

- **Human-like mouse movement** - Bezier curves, variable speed
- **Random click offset** - doesn't click exact center
- **Variable delays** - 30-90 seconds between actions
- **Working hours** - AM/PM configurable
- **Daily limits** - per action type
- **Random pauses** - every 5-10 actions

## Outreach Workflow (Example)

1. **Create scraping run** - search for posts about your topic
2. **Go to Campaigns** - create new campaign with message template
3. **Import leads** - select scraping run, import commenters + reactors
4. **Score leads** - mark best ones as HOT
5. **Queue connects** - "Queue CONNECT (HOT first)"
6. **Run automation script** - on your Mac
7. **Update statuses** - manually mark CONNECTED when accepted
8. **Queue messages** - "Queue MESSAGE1" for connected leads

## Local Development

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
# Open http://localhost:3000
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
APIFY_API_TOKEN="apify_api_xxxxx"
```

## Server Commands

```bash
# View logs
pm2 logs intent2reach --lines 50

# Restart
pm2 restart all

# Force update
git fetch origin
git reset --hard origin/claude/apify-actor-service-eDOKE
npm install && npx prisma db push && npm run build && pm2 restart all
```

## Troubleshooting

### "No actions in queue" but queue shows pending
Run `npx prisma generate` to update Prisma client with new action types.

### Connection request not sending
LinkedIn UI changes frequently. Check browser console for errors. The script handles:
- Direct Connect button
- Connect in "More" dropdown
- "Send without a note" modal

### Import shows 0 leads
Check that scraping run has comments/reactions in rawData. Different Apify actors may structure data differently.
