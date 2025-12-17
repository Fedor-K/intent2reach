# Intent2Reach - LinkedIn Scraping Service

LinkedIn scraping service powered by Apify. Автоматический сбор постов, комментариев и реакций из LinkedIn.

## Production

- **URL**: https://intenttoreach.com
- **Server IP**: 198.12.73.168 (RackNerd VPS)
- **Branch**: `claude/apify-actor-service-eDOKE`

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
   - Filter by author LinkedIn URLs
   - Filter by companies
   - Time period: 24h, week, month, 3months, 6months, year, any
   - Max posts limit (limits on our side, Apify ignores this param)
   - Scrape comments checkbox
   - Scrape reactions checkbox

2. **Results Table**
   - Author info: avatar, name, @username, headline
   - Post text with type badge
   - Engagement metrics (likes, comments, shares)
   - Post date
   - Links to post and author profile
   - **Expandable rows** - click chevron (▼) to see reactions and comments
   - **View Raw JSON** button for debugging Apify data structure

3. **Reactions & Comments Display**
   - Shows all users who reacted with reaction type (LIKE, EMPATHY, PRAISE, etc.)
   - Shows all comments with author info and comment text
   - Links to LinkedIn profiles (when available)
   - **Note**: Reactions often show "Unknown" because Apify doesn't collect full author details

4. **Run Management**
   - List all runs with status badge
   - Auto-refresh status every 5 seconds while running
   - Stop button works for PENDING and RUNNING states
   - View results for completed runs

## Project Structure

```
intent2reach/
├── src/
│   ├── app/
│   │   ├── api/scraping/runs/     # API endpoints
│   │   │   ├── route.ts           # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts       # GET single run
│   │   │       ├── status/        # GET check/update status
│   │   │       ├── results/       # GET results (paginated)
│   │   │       └── abort/         # POST abort run
│   │   ├── page.tsx               # Main dashboard
│   │   ├── layout.tsx             # Root layout (system font)
│   │   └── globals.css            # Tailwind styles
│   ├── components/
│   │   ├── CreateRunForm.tsx      # New run form
│   │   ├── RunsList.tsx           # Runs table
│   │   └── ResultsTable.tsx       # Results with expandable rows
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

## Key Files

### `src/lib/apify.ts`
- `createScrapingRun()` - creates DB record, starts actor async
- `fetchAndSaveResults()` - gets Apify dataset, filters posts only, saves to DB
- `checkRunStatus()` - syncs status with Apify
- `abortRun()` - stops pending/running jobs
- Filters: `item.type === 'post' || !item.type` (excludes reactions/comments items)
- `rawData` field stores full Apify response for each post (includes reactions, comments arrays)

### `src/components/ResultsTable.tsx`
- `getAuthorInfo()` helper - extracts name/avatar/url from various Apify structures
- Expandable rows with chevron toggle
- Raw JSON modal for debugging
- Reactions and comments display in 2-column grid

### `src/components/CreateRunForm.tsx`
- postedLimit options: 24h, week, month, 3months, 6months, year, any
- maxPosts input (text type to allow clearing)

## Database Schema

```prisma
model ScrapingRun {
  id               Int       @id @default(autoincrement())
  status           RunStatus // PENDING, RUNNING, SUCCEEDED, FAILED, ABORTED
  apifyRunId       String?
  searchQueries    String[]
  authorUrls       String[]
  authorsCompanies String[]
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
```

## Apify Actor Input

Valid `postedLimit` values: `"any"`, `"24h"`, `"week"`, `"month"`, `"3months"`, `"6months"`, `"year"`

```json
{
  "searchQueries": ["keyword"],
  "authorUrls": ["https://linkedin.com/in/username"],
  "authorsCompanies": [],
  "postedLimit": "week",
  "commentsPostedLimit": "week",
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

## Apify Response Structure (per post)

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
      "author": { ... }  // May be incomplete
    }
  ],
  "comments": [
    {
      "author": { ... },
      "text": "Comment text",
      "postedAt": { "date": "..." },
      "likesCount": 0
    }
  ]
}
```

## Server Deployment

### Quick Update
```bash
cd /var/www/intent2reach
git pull
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

1. **Reactions show "Unknown"** - Apify doesn't always collect author details for reactions
2. **maxPosts ignored by Apify** - We limit results on our side in `fetchAndSaveResults()`
3. **Google Fonts fail in build** - Switched to system font (`font-sans`)

## Troubleshooting

### "Invalid value provided. Expected Int"
Fixed with `toInt()` helper in apify.ts - handles empty/null values from Apify.

### "postedLimit must be one of allowed values"
Use: `24h`, `week`, `month`, `3months`, `6months`, `year`, `any` (NOT `7d`, `30d`)

### Run fails immediately
Check `pm2 logs intent2reach` for error details.

### git pull conflict
```bash
rm package-lock.json
git pull
npm install
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
