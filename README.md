# Intent2Reach - LinkedIn Scraping Service

LinkedIn scraping service powered by Apify. Автоматический сбор постов, комментариев и реакций из LinkedIn.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Scraping**: Apify Actor (`buIWk2uOUzTmcLsuB`)

## Project Structure

```
intent2reach/
├── src/
│   ├── app/
│   │   ├── api/scraping/runs/     # API endpoints
│   │   │   ├── route.ts           # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts       # GET single run
│   │   │       ├── status/        # GET check status
│   │   │       ├── results/       # GET results
│   │   │       └── abort/         # POST abort run
│   │   ├── page.tsx               # Dashboard UI
│   │   ├── layout.tsx             # Root layout
│   │   └── globals.css            # Global styles
│   ├── components/
│   │   ├── CreateRunForm.tsx      # Form to start scraping
│   │   ├── RunsTable.tsx          # List of scraping runs
│   │   ├── ResultsTable.tsx       # Scraped results table
│   │   └── StatusBadge.tsx        # Status indicator
│   ├── lib/
│   │   ├── apify.ts               # Apify service
│   │   └── db.ts                  # Prisma client
│   └── types/
│       └── index.ts               # TypeScript types
├── prisma/
│   └── schema.prisma              # Database schema
├── .env.example                   # Environment template
├── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scraping/runs` | Create and start new scraping run |
| `GET` | `/api/scraping/runs` | List all runs (paginated) |
| `GET` | `/api/scraping/runs/[id]` | Get single run details |
| `GET` | `/api/scraping/runs/[id]/status` | Check and update run status |
| `GET` | `/api/scraping/runs/[id]/results` | Get results (paginated) |
| `POST` | `/api/scraping/runs/[id]/abort` | Abort running actor |

## Database Schema

### ScrapingRun
- `id` - Primary key
- `apifyRunId` - Apify run identifier
- `status` - PENDING | RUNNING | SUCCEEDED | FAILED | ABORTED
- `searchQueries` - Array of search terms
- `authorUrls` - Array of LinkedIn profile URLs
- `authorsCompanies` - Array of company names
- `postedLimit` - Time filter (24h, 7d, 30d, 365d)
- `maxPosts` - Maximum posts to scrape
- `resultsCount` - Number of results
- `createdAt`, `startedAt`, `finishedAt` - Timestamps
- `errorMessage` - Error details if failed

### ScrapingResult
- `id` - Primary key
- `runId` - Foreign key to ScrapingRun
- `postUrl`, `postId`, `postText`, `postDate` - Post data
- `authorName`, `authorUrl`, `authorHeadline`, `authorCompany` - Author data
- `likesCount`, `commentsCount`, `sharesCount` - Engagement metrics
- `rawData` - Original JSON from Apify

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
APIFY_API_TOKEN="your_apify_api_token"
```

## Local Development

```bash
# Install dependencies
npm install

# Setup database
npx prisma db push

# Run development server
npm run dev

# Open http://localhost:3000
```

## Production Deployment (VPS)

### Server Requirements
- Ubuntu 20.04+
- Node.js 20+
- Nginx
- PM2

### Setup Commands

```bash
# 1. Update system
apt update && apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install PM2 and Nginx
npm install -g pm2
apt install -y nginx

# 4. Clone repository
cd /var/www
git clone https://github.com/Fedor-K/intent2reach.git
cd intent2reach
git checkout claude/apify-actor-service-eDOKE

# 5. Create .env file
cat > .env << 'EOF'
DATABASE_URL="your_database_url"
APIFY_API_TOKEN="your_apify_token"
EOF

# 6. Install and build
npm install
npx prisma generate
npm run build

# 7. Start with PM2
pm2 start npm --name "intent2reach" -- start
pm2 save
pm2 startup
```

### Nginx Configuration

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

### SSL with Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d intenttoreach.com -d www.intenttoreach.com
```

## Server Details

- **IP**: 198.12.73.168
- **Domain**: intenttoreach.com
- **Provider**: RackNerd KVM VPS

## Credentials (Production)

Stored in `.env` file on server:
- Database: Neon PostgreSQL
- Apify API Token: For LinkedIn scraping actor

## Features

- Create scraping runs with search queries, author URLs, or company filters
- Auto-refresh run status every 5 seconds
- View scraped results in paginated table
- Stop running/pending scraping jobs
- Export engagement metrics (likes, comments, shares)

## Apify Actor Input Parameters

```json
{
  "searchQueries": ["keyword"],
  "authorUrls": ["https://linkedin.com/in/username"],
  "authorsCompanies": ["Company Name"],
  "postedLimit": "24h",
  "maxPosts": 100,
  "maxComments": 100,
  "maxReactions": 100,
  "scrapeComments": true,
  "scrapeReactions": true,
  "scrapePages": 1,
  "sortBy": "date"
}
```

## Troubleshooting

### "Invalid value provided. Expected Int"
Apify returns empty values for some numeric fields. Fixed with `toInt()` helper function.

### Server not responding
Check PM2 status:
```bash
pm2 status
pm2 logs intent2reach
```

### Database connection issues
Verify DATABASE_URL in .env and that IP is whitelisted in Neon dashboard.
