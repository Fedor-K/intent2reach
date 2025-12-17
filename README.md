# Intent2Reach - LinkedIn Scraping Service

LinkedIn scraping service powered by Apify. Автоматический сбор постов, комментариев и реакций из LinkedIn.

## Production

- **URL**: https://intenttoreach.com
- **Server IP**: 198.12.73.168 (RackNerd VPS)
- **Branch**: `claude/apify-actor-service-eDOKE`
- **Server Path**: `/var/www/intent2reach`

### Deploy to Server (Quick Reference)
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
- **Scraping**: Apify Actor `buIWk2uOUzTmcLsuB`
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy with SSL)

## Features

### 1. Scraping Tab
- **Create Scraping Runs**
  - Search by keywords (one per line)
  - LinkedIn URLs - accepts BOTH profile (`/in/username`) AND company (`/company/12345/`) URLs
  - Filter by company name (text, not URL)
  - Time period: 24h, week, month, 3months, 6months, year, any
  - Max posts limit
  - Scrape comments/reactions checkboxes

- **Results Table**
  - Author info: avatar, name, @username, headline/position
  - Post text with type badge
  - Engagement metrics (likes, comments, shares)
  - Expandable rows - click chevron to see reactions and comments
  - View Raw JSON button for debugging

- **Run Management**
  - List all runs with status badge
  - Auto-refresh status every 5 seconds
  - Stop button for PENDING/RUNNING states

### 2. Activity Feed Tab
- **Individual engagement tracking** - каждое действие отдельной записью
- Shows: Person → Action → Post → Time ago
- **Filter by action type**: Comments, Likes, Empathy, Praise, Appreciation
- **Search by**: name, position, post author, keyword, comment text
- Comment text displayed for COMMENT engagements
- Post preview with author name
- **Queue actions**: Click Like/Connect buttons to add to automation queue
- Export to CSV
- Bulk delete

### 3. Automation Tab (NEW - Browser Automation)
- **Human-like LinkedIn automation** - медленно, с перерывами, как человек
- Runs as a separate script (not in Next.js) for browser control
- **Actions supported**: Like posts, Send connections, View profiles
- **Safety features**:
  - Daily limits per action type (configurable)
  - Random delays between actions (30-90 seconds default)
  - Working hours restriction (9:00-18:00 default)
  - Random pauses every 5-10 actions
- **Session management**: Browser opens, you log in manually, script detects login
- Settings configurable via web dashboard

### 4. API Endpoints

**Scraping:**
- `GET /api/scraping/runs` - List runs
- `POST /api/scraping/runs` - Create run
- `GET /api/scraping/runs/[id]/results` - Get results
- `POST /api/scraping/runs/[id]/abort` - Stop run

**Activity Feed:**
- `GET /api/engagements` - List engagements (search, filter, pagination)
- `DELETE /api/engagements` - Bulk delete
- `POST /api/engagements/backfill` - Extract from existing results

**Automation:**
- `GET /api/automation/session` - Get browser/session status
- `POST /api/automation/session` - Update session (pause/resume)
- `GET /api/automation/queue` - List queued actions
- `POST /api/automation/queue` - Add action to queue
- `DELETE /api/automation/queue` - Remove/clear actions
- `GET /api/automation/settings` - Get automation settings
- `PUT /api/automation/settings` - Update settings
- `GET /api/automation/stats` - Get daily statistics

**Leads (legacy):**
- `GET /api/leads` - List leads aggregated by person
- `POST /api/leads/backfill` - Extract leads

## Project Structure

```
intent2reach/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── scraping/runs/     # Scraping API
│   │   │   ├── engagements/       # Activity Feed API
│   │   │   │   ├── route.ts       # GET list, DELETE bulk
│   │   │   │   └── backfill/      # POST extract from results
│   │   │   └── leads/             # Legacy Leads API
│   │   ├── page.tsx               # Main dashboard (tabs: Scraping | Activity Feed)
│   │   ├── layout.tsx             # Root layout
│   │   └── globals.css            # Tailwind styles
│   ├── components/
│   │   ├── CreateRunForm.tsx      # New run form
│   │   ├── RunsTable.tsx          # Runs table
│   │   ├── ResultsTable.tsx       # Results with expandable rows
│   │   ├── EngagementsTable.tsx   # Activity Feed component
│   │   └── LeadsTable.tsx         # Legacy leads table
│   ├── lib/
│   │   ├── apify.ts               # Apify client, actor calls
│   │   └── db.ts                  # Prisma client singleton
│   └── types/
│       └── index.ts               # TypeScript interfaces
├── prisma/
│   └── schema.prisma              # Database schema
├── .env                           # Environment variables
└── package.json
```

## Database Schema

```prisma
model ScrapingRun {
  id               Int       @id @default(autoincrement())
  status           RunStatus // PENDING, RUNNING, SUCCEEDED, FAILED, ABORTED
  apifyRunId       String?
  searchQueries    String[]
  authorUrls       String[]  // Profile AND company URLs
  authorsCompanies String[]  // Company names (text filter)
  postedLimit      String    @default("24h")
  maxPosts         Int       @default(100)
  // ... other fields
  results          ScrapingResult[]
}

model ScrapingResult {
  id              Int      @id @default(autoincrement())
  runId           Int
  postUrl         String?
  postText        String?
  authorName      String?
  rawData         Json?    // Full Apify item with reactions[], comments[]
  // ... other fields
}

model Engagement {
  id                  Int      @id @default(autoincrement())

  // Person who engaged
  personLinkedinUrl   String
  personName          String
  personPosition      String?
  personAvatarUrl     String?

  // Type of engagement
  engagementType      String   // LIKE, COMMENT, EMPATHY, PRAISE, APPRECIATION

  // Post that was engaged with
  postUrl             String
  postText            String?  // First ~200 chars
  postAuthorName      String?
  postAuthorUrl       String?

  // Comment text (if type=COMMENT)
  commentText         String?

  // Search context
  searchQuery         String?  // Which keyword matched

  // Source tracking
  runId               Int
  resultId            Int?

  // Timestamps
  engagedAt           DateTime?
  createdAt           DateTime @default(now())

  @@unique([personLinkedinUrl, postUrl, engagementType])
}

model Lead {
  id              Int      @id @default(autoincrement())
  linkedinUrl     String   @unique
  name            String
  position        String?
  engagementTypes String[]
  sourcePostUrls  String[]
  // ... aggregated by person
}
```

## Apify Data Structure

```json
{
  "type": "post",
  "linkedinUrl": "https://linkedin.com/feed/update/...",
  "content": "Post text...",
  "author": {
    "name": "John Doe",
    "linkedinUrl": "https://linkedin.com/in/johndoe"
  },
  "reactions": [
    {
      "reactionType": "LIKE",
      "actor": {
        "name": "Jane Smith",
        "picture": { "url": "https://..." },
        "position": "Designer",
        "linkedinUrl": "https://linkedin.com/in/janesmith"
      }
    }
  ],
  "comments": [
    {
      "actor": { "name": "Bob", "linkedinUrl": "..." },
      "commentary": "Great post!",
      "createdAt": "2025-12-16T14:17:15.300Z"
    }
  ]
}
```

**Key field mappings:**
- Comment text: `commentary` (NOT `text`)
- Avatar: `actor.picture.url` or `actor.pictureUrl`
- Position: `actor.position`
- Author in reactions/comments: `actor` (NOT `author`)

## Backfill Commands

After deploying, run backfill to extract engagements from existing data:

```bash
# Extract individual engagements for Activity Feed
curl -X POST https://intenttoreach.com/api/engagements/backfill

# Extract aggregated leads (legacy)
curl -X POST https://intenttoreach.com/api/leads/backfill
```

## Server Deployment

### Quick Update
```bash
cd /var/www/intent2reach
git pull origin claude/apify-actor-service-eDOKE
npm install
npm run build
pm2 restart all
```

### Force Update (if conflicts)
```bash
cd /var/www/intent2reach
git fetch origin
git reset --hard origin/claude/apify-actor-service-eDOKE
npm install
npx prisma db push
npm run build
pm2 restart all
```

### View Logs
```bash
pm2 logs intent2reach --lines 50
```

## Running Automation (Browser Script)

The automation runs as a separate script that opens a visible browser window. **Run it on your local Mac/PC, not on the server.**

### Quick Start (Mac/PC)

```bash
# 1. Clone repo
git clone https://github.com/Fedor-K/intent2reach.git
cd intent2reach

# 2. Create .env file with database connection
cat > .env << 'EOF'
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-polished-breeze-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
EOF

# 3. Install dependencies
npm install
npx prisma generate

# 4. Run automation
npx tsx scripts/automation.ts
```

### How it works

1. Script opens Chrome browser with a persistent profile
2. Navigates to LinkedIn
3. **You manually log in** (script doesn't store your password)
4. Script detects when you're logged in
5. Starts processing actions from the queue (web dashboard)
6. If session expires, script pauses and waits for re-login

### Supported Actions

- **LIKE** - Like posts from the queue
- **CONNECT** - Send connection requests (handles both direct button and "More" dropdown)
- **PROFILE_VIEW** - View profiles

### Safety Features

- Random delays between actions (30-90 seconds)
- Daily limits per action type (configurable in web UI)
- Working hours restriction (9:00-18:00 by default)
- Random pauses every 5-10 actions
- Human-like scrolling and mouse movements

### Important

- Browser window can be minimized but must stay open
- Your credentials are NEVER stored by the system
- Actions are added via the web dashboard (Activity Feed → click Like/Connect buttons)

## Local Development

```bash
npm install
npx prisma generate
npx prisma db push  # if schema changed
npm run dev
# Open http://localhost:3000
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
APIFY_API_TOKEN="apify_api_xxxxx"
```

## Known Issues

1. **maxPosts ignored by Apify** - We limit results on our side
2. **Google Fonts fail in build** - Using system font (`font-sans`)

## Troubleshooting

### "postedLimit must be one of allowed values"
Use: `24h`, `week`, `month`, `3months`, `6months`, `year`, `any`

### Company URL not working
Put company URLs in "LinkedIn URLs" field. Both `/in/` and `/company/` URLs go to `authorUrls`.

### Search not working in Activity Feed
Search works by: person name, position, **post author name**, **keyword**, comment text, post text
