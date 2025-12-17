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

## Features (Current State - Dec 17, 2025)

### Working Features
1. **Create Scraping Runs**
   - Search by keywords (one per line)
   - **LinkedIn URLs** - accepts BOTH profile (`/in/username`) AND company (`/company/12345/`) URLs
   - Filter by company name (text, not URL)
   - Time period: 24h, week, month, 3months, 6months, year, any
   - Max posts limit
   - Scrape comments checkbox
   - Scrape reactions checkbox

2. **Results Table**
   - Author info: avatar, name, @username, headline/position
   - Post text with type badge
   - Engagement metrics (likes, comments, shares)
   - Post date
   - Links to post and author profile
   - **Expandable rows** - click chevron (▼) to see reactions and comments
   - **View Raw JSON** button for debugging Apify data structure

3. **Reactions & Comments Display**
   - Shows all users who reacted with reaction type (LIKE, EMPATHY, PRAISE, etc.)
   - Shows all comments with author info, position, and **comment text**
   - Avatars displayed for reactions and comments
   - Links to LinkedIn profiles

4. **Run Management**
   - List all runs with status badge
   - Auto-refresh status every 5 seconds while running
   - Stop button works for PENDING and RUNNING states
   - View results for completed runs

5. **Leads CRM** (NEW)
   - Automatically collects people who liked or commented on posts
   - Deduplicates by LinkedIn URL across all runs
   - Tracks engagement types (LIKE, COMMENT, EMPATHY, PRAISE)
   - Stores first/last seen dates
   - Search by name or position
   - Filter by engagement type
   - Export to CSV
   - Bulk delete

## Project Structure

```
intent2reach/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── scraping/runs/     # Scraping API endpoints
│   │   │   │   ├── route.ts       # GET list, POST create
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts   # GET single run
│   │   │   │       ├── status/    # GET check/update status
│   │   │   │       ├── results/   # GET results (paginated)
│   │   │   │       └── abort/     # POST abort run
│   │   │   └── leads/             # Leads CRM API
│   │   │       └── route.ts       # GET list, DELETE bulk
│   │   ├── page.tsx               # Main dashboard (tabs: Scraping | Leads)
│   │   ├── layout.tsx             # Root layout (system font)
│   │   └── globals.css            # Tailwind styles
│   ├── components/
│   │   ├── CreateRunForm.tsx      # New run form
│   │   ├── RunsList.tsx           # Runs table
│   │   ├── ResultsTable.tsx       # Results with expandable rows
│   │   └── LeadsTable.tsx         # Leads CRM table
│   ├── lib/
│   │   ├── apify.ts               # Apify client, actor calls, lead extraction
│   │   └── db.ts                  # Prisma client singleton
│   └── types/
│       └── index.ts               # TypeScript interfaces
├── prisma/
│   └── schema.prisma              # Database schema
├── .env                           # Environment variables
└── package.json
```

## Key Files

### `src/lib/apify.ts`
- `createScrapingRun()` - creates DB record, starts actor async
- `fetchAndSaveResults()` - gets Apify dataset, filters posts only, saves to DB
- `checkRunStatus()` - syncs status with Apify
- `abortRun()` - stops pending/running jobs
- Filters: `item.type === 'post' || !item.type` (excludes reactions/comments items)
- `rawData` field stores full Apify response for each post (includes reactions, comments arrays)

### `src/components/ResultsTable.tsx`
- `getAuthorInfo()` helper - extracts author data from Apify structures:
  - Name: `actor.name`
  - Avatar: `actor.picture.url` or `actor.pictureUrl`
  - Position: `actor.position`
  - LinkedIn URL: `actor.linkedinUrl`
- Comment text: `comment.commentary` field
- Expandable rows with chevron toggle
- Raw JSON modal for debugging

### `src/components/CreateRunForm.tsx`
- **LinkedIn URLs field** - accepts both `/in/` profiles and `/company/` URLs → all go to `authorUrls`
- **Company name field** - text filter, NOT URLs
- postedLimit options: 24h, week, month, 3months, 6months, year, any

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
  maxComments      Int       @default(100)
  maxReactions     Int       @default(100)
  scrapeComments   Boolean   @default(true)
  scrapeReactions  Boolean   @default(true)
  scrapePages      Int       @default(1)
  sortBy           String    @default("date")
  resultsCount     Int?
  errorMessage     String?
  createdAt        DateTime  @default(now())
  startedAt        DateTime?
  finishedAt       DateTime?
  results          ScrapingResult[]
}

model ScrapingResult {
  id              Int      @id @default(autoincrement())
  runId           Int
  run             ScrapingRun @relation(...)
  postType        String?
  postUrl         String?
  postId          String?
  postText        String?
  postDate        DateTime?
  authorName      String?
  authorUrl       String?
  authorUsername  String?
  authorHeadline  String?
  authorAvatarUrl String?
  likesCount      Int      @default(0)
  commentsCount   Int      @default(0)
  sharesCount     Int      @default(0)
  rawData         Json?    // Full Apify item with reactions[], comments[]
  createdAt       DateTime @default(now())
}

model Lead {
  id              Int      @id @default(autoincrement())
  linkedinUrl     String   @unique  // Dedupe key
  linkedinId      String?
  name            String
  position        String?
  avatarUrl       String?
  engagementTypes String[] // ["LIKE", "COMMENT", "EMPATHY", "PRAISE"]
  sourcePostUrls  String[] // Posts where this person engaged
  sourceRunIds    Int[]    // Runs that found this lead
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @default(now())
}
```

## Apify Actor Input

**IMPORTANT**: Both profile URLs (`/in/`) and company URLs (`/company/`) go to `authorUrls`!

Valid `postedLimit` values: `"any"`, `"24h"`, `"week"`, `"month"`, `"3months"`, `"6months"`, `"year"`

```json
{
  "searchQueries": ["keyword"],
  "authorUrls": [
    "https://linkedin.com/in/username",
    "https://linkedin.com/company/12345/"
  ],
  "authorsCompanies": [],
  "postedLimit": "week",
  "maxPosts": 10,
  "maxComments": 100,
  "maxReactions": 100,
  "scrapeComments": true,
  "scrapeReactions": true,
  "scrapePages": 1,
  "sortBy": "date",
  "startPage": 1
}
```

## Apify Response Structure (ACTUAL)

```json
{
  "type": "post",
  "linkedinUrl": "https://linkedin.com/feed/update/...",
  "content": "Post text...",
  "author": {
    "name": "John Doe",
    "linkedinUrl": "https://linkedin.com/in/johndoe",
    "publicIdentifier": "johndoe",
    "avatar": { "url": "https://..." },
    "info": "Software Engineer at Company"
  },
  "postedAt": { "date": "2025-12-17T..." },
  "engagement": {
    "likes": 10,
    "comments": 5,
    "shares": 2
  },
  "reactions": [
    {
      "reactionType": "LIKE",
      "actor": {
        "name": "Jane Smith",
        "picture": { "url": "https://..." },
        "pictureUrl": "https://...",
        "position": "Designer at Company",
        "linkedinUrl": "https://linkedin.com/in/janesmith"
      }
    }
  ],
  "comments": [
    {
      "actor": {
        "name": "Bob Wilson",
        "picture": { "url": "https://..." },
        "position": "CEO at Startup",
        "linkedinUrl": "https://linkedin.com/in/bobwilson"
      },
      "commentary": "Great post!",
      "createdAt": "2025-12-16T14:17:15.300Z",
      "engagement": { "likes": 0 }
    }
  ]
}
```

**Key field mappings:**
- Comment text: `commentary` (NOT `text`)
- Avatar: `actor.picture.url` or `actor.pictureUrl`
- Position/Headline: `actor.position`
- Author in reactions/comments: `actor` (NOT `author`)

## Server Deployment

### Quick Update
```bash
cd /var/www/intent2reach
git pull
npm install
npm run build
pm2 restart intent2reach
```

### Force Update (if conflicts)
```bash
cd /var/www/intent2reach
git fetch origin
git reset --hard origin/claude/apify-actor-service-eDOKE
npm install
npm run build
pm2 restart intent2reach
```

### View Logs
```bash
pm2 logs intent2reach --lines 50
```

### Full Setup (new server)
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 and Nginx
npm install -g pm2
apt install -y nginx

# Clone and setup
cd /var/www
git clone https://github.com/Fedor-K/intent2reach.git
cd intent2reach
git checkout claude/apify-actor-service-eDOKE

# Create .env
cat > .env << 'EOF'
DATABASE_URL="postgresql://..."
APIFY_API_TOKEN="apify_api_..."
EOF

# Build
npm install
npx prisma generate
npm run build

# Start
pm2 start npm --name "intent2reach" -- start
pm2 save && pm2 startup

# SSL
apt install -y certbot python3-certbot-nginx
certbot --nginx -d intenttoreach.com
```

### Nginx Config
```nginx
server {
    listen 80;
    server_name intenttoreach.com www.intenttoreach.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Known Issues

1. **maxPosts ignored by Apify** - We limit results on our side in `fetchAndSaveResults()`
2. **Google Fonts fail in build** - Switched to system font (`font-sans`)

## Troubleshooting

### "postedLimit must be one of allowed values"
Use: `24h`, `week`, `month`, `3months`, `6months`, `year`, `any` (NOT `7d`, `30d`)

### Company URL not working
Put company URLs in "LinkedIn URLs" field, NOT "Company name" field. Both `/in/` and `/company/` URLs go to `authorUrls`.

### Run fails immediately
Check `pm2 logs intent2reach` for error details.

### git pull conflict
```bash
git fetch origin
git reset --hard origin/claude/apify-actor-service-eDOKE
npm install
npm run build
pm2 restart intent2reach
```

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
