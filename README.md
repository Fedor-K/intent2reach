# Intent2Reach - LinkedIn Intelligence Platform

LinkedIn scraping and outreach automation platform for finding and engaging with potential leads.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SCRAPING          │  ACTIVITY FEED     │  AUTOMATION                   │
│  ─────────         │  ─────────────     │  ──────────                   │
│  Search LinkedIn   │  Track who engages │  Campaigns + Browser Queue    │
│  posts by keywords │  with your content │                               │
│                    │                    │  ┌─────────────────────────┐  │
│  Extract:          │  Filter by:        │  │ NEW → INVITED →         │  │
│  • Comments        │  • Action type     │  │ CONNECTED → MSG1 → DONE │  │
│  • Reactions       │  • Name/Position   │  └─────────────────────────┘  │
│  • Post authors    │  • Keywords        │                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Links

- **Production URL**: https://intenttoreach.com
- **Server**: 198.12.73.168 (RackNerd VPS)
- **Branch**: `claude/apify-actor-service-eDOKE`
- **Server Path**: `/var/www/intent2reach`

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Features](#features)
6. [API Reference](#api-reference)
7. [Setup & Installation](#setup--installation)
8. [Running Automation](#running-automation)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL (Neon.tech) |
| **ORM** | Prisma |
| **Styling** | Tailwind CSS |
| **Scraping** | Apify Actor (`buIWk2uOUzTmcLsuB`) |
| **Browser Automation** | Puppeteer-core |
| **Process Manager** | PM2 (production) |
| **Deployment** | Ubuntu VPS, Nginx reverse proxy |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            INTENT2REACH SYSTEM                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐     ┌──────────────────────────────────────────┐ │
│  │   WEB APPLICATION    │     │           AUTOMATION SCRIPT               │ │
│  │   (Next.js Server)   │     │        (Separate Process on Mac)         │ │
│  │                      │     │                                          │ │
│  │  ┌────────────────┐  │     │  ┌────────────────────────────────────┐  │ │
│  │  │ React Frontend │  │     │  │    scripts/automation.ts           │  │ │
│  │  │                │  │     │  │                                    │  │ │
│  │  │ • Scraping Tab │  │     │  │ 1. Opens Chrome with saved profile │  │ │
│  │  │ • Activity Tab │  │     │  │ 2. Waits for manual LinkedIn login │  │ │
│  │  │ • Automation   │  │     │  │ 3. Reads queue from database       │  │ │
│  │  │   - Campaigns  │  │     │  │ 4. Executes: LIKE, CONNECT, MSG    │  │ │
│  │  │   - Queue      │  │     │  │ 5. Uses Bezier curves for mouse    │  │ │
│  │  └────────────────┘  │     │  │ 6. Random delays 30-90 sec         │  │ │
│  │          │           │     │  └──────────────┬─────────────────────┘  │ │
│  │          ▼           │     │                 │                        │ │
│  │  ┌────────────────┐  │     │                 │                        │ │
│  │  │  API Routes    │  │     │                 │                        │ │
│  │  │ /api/scraping  │  │     │                 │                        │ │
│  │  │ /api/campaigns │◄─┼─────┼─────────────────┘                        │ │
│  │  │ /api/queue     │  │     │                                          │ │
│  │  │ /api/settings  │  │     │                                          │ │
│  │  └───────┬────────┘  │     └──────────────────────────────────────────┘ │
│  │          │           │                                                  │
│  └──────────┼───────────┘                                                  │
│             ▼                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                        POSTGRESQL (Neon)                            │   │
│  │                                                                     │   │
│  │  ScrapingRun    ScrapingResult    Lead    Engagement               │   │
│  │  Campaign       CampaignLead      ActionQueue    AutomationSettings│   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                          APIFY CLOUD                                │   │
│  │                                                                     │   │
│  │  LinkedIn Posts Scraper Actor (buIWk2uOUzTmcLsuB)                  │   │
│  │  - Searches posts by keywords                                       │   │
│  │  - Extracts comments and reactions                                  │   │
│  │  - Returns structured JSON                                          │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. SCRAPING FLOW
   User creates run → API starts Apify actor → Results saved → Leads extracted

2. ACTIVITY FEED FLOW
   Results in DB → Backfill extracts engagements → Filter/Search → Queue actions

3. OUTREACH CAMPAIGN FLOW
   Create campaign → Import leads from run → Score HOT/WARM → Queue CONNECT
   → Automation sends requests → Mark CONNECTED → Queue MESSAGE1

4. AUTOMATION FLOW
   Web dashboard queues actions → Automation script reads DB → Executes in browser
```

---

## Project Structure

```
intent2reach/
├── prisma/
│   └── schema.prisma          # Database models and enums
│
├── scripts/
│   └── automation.ts          # Browser automation script (runs on Mac)
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── scraping/
│   │   │   │   └── runs/
│   │   │   │       ├── route.ts           # GET/POST runs list
│   │   │   │       └── [id]/
│   │   │   │           ├── route.ts       # GET single run
│   │   │   │           ├── status/route.ts
│   │   │   │           ├── results/route.ts
│   │   │   │           └── abort/route.ts
│   │   │   │
│   │   │   ├── engagements/
│   │   │   │   ├── route.ts               # GET engagements list
│   │   │   │   └── backfill/route.ts      # POST extract from results
│   │   │   │
│   │   │   ├── automation/
│   │   │   │   ├── session/route.ts       # GET/POST session status
│   │   │   │   ├── queue/route.ts         # GET/POST/DELETE action queue
│   │   │   │   ├── settings/route.ts      # GET/PUT settings
│   │   │   │   └── stats/route.ts         # GET daily stats
│   │   │   │
│   │   │   ├── campaigns/
│   │   │   │   ├── route.ts               # GET/POST campaigns list
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts           # GET/PUT/DELETE campaign
│   │   │   │       └── leads/
│   │   │   │           ├── route.ts       # GET/POST/PUT leads
│   │   │   │           └── queue/route.ts # POST queue actions
│   │   │   │
│   │   │   └── leads/
│   │   │       └── route.ts               # GET leads (legacy)
│   │   │
│   │   ├── layout.tsx                     # Root layout
│   │   └── page.tsx                       # Main dashboard page
│   │
│   ├── components/
│   │   ├── CreateRunForm.tsx              # Scraping run form
│   │   ├── RunsTable.tsx                  # List of scraping runs
│   │   ├── ResultsTable.tsx               # Scraping results with expandable rows
│   │   ├── EngagementsTable.tsx           # Activity feed table
│   │   ├── LeadsTable.tsx                 # Leads list (legacy)
│   │   ├── AutomationPanel.tsx            # Browser status + action queue
│   │   ├── AutomationWrapper.tsx          # Sub-tabs: Campaigns / Browser & Queue
│   │   ├── CampaignsPanel.tsx             # Campaigns list + create form
│   │   ├── CampaignLeadsPanel.tsx         # Campaign leads management
│   │   └── StatusBadge.tsx                # Status indicator component
│   │
│   ├── lib/
│   │   ├── db.ts                          # Prisma client singleton
│   │   └── apify.ts                       # Apify client + scraping logic
│   │
│   └── types/
│       └── index.ts                       # TypeScript interfaces
│
├── .env                                   # Environment variables (not in git)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Database Schema

### Enums

```prisma
enum RunStatus { PENDING, RUNNING, SUCCEEDED, FAILED, ABORTED }
enum ActionStatus { PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED }
enum ActionType { LIKE, CONNECT, CONNECT_NO_NOTE, MESSAGE, MESSAGE1, COMMENT, PROFILE_VIEW }
enum LeadTemperature { HOT, WARM }
enum LeadStatus { NEW, INVITED, CONNECTED, MSG1, DONE }
```

### Models

#### Scraping

```prisma
model ScrapingRun {
  id               Int       @id @default(autoincrement())
  apifyRunId       String?   @unique
  status           RunStatus @default(PENDING)

  // Input parameters
  searchQueries    String[]
  authorUrls       String[]
  authorsCompanies String[]
  postedLimit      String    @default("24h")   // 24h, week, month
  maxPosts         Int       @default(100)
  maxComments      Int       @default(100)
  maxReactions     Int       @default(100)
  scrapeComments   Boolean   @default(true)
  scrapeReactions  Boolean   @default(true)

  // Timestamps & results
  createdAt        DateTime  @default(now())
  startedAt        DateTime?
  finishedAt       DateTime?
  resultsCount     Int       @default(0)
  errorMessage     String?

  results          ScrapingResult[]
}

model ScrapingResult {
  id              Int      @id @default(autoincrement())
  runId           Int

  // Post data
  postUrl         String?
  postText        String?
  postDate        DateTime?

  // Author data
  authorName      String?
  authorUrl       String?
  authorHeadline  String?

  // Engagement counts
  likesCount      Int      @default(0)
  commentsCount   Int      @default(0)

  // Raw JSON with full comments, reactions arrays
  rawData         Json?

  run             ScrapingRun @relation(...)
}
```

#### Activity Feed

```prisma
model Engagement {
  id                Int      @id @default(autoincrement())

  // Person who engaged
  personLinkedinUrl String
  personName        String
  personPosition    String?

  // Type: LIKE, COMMENT, EMPATHY, PRAISE, etc.
  engagementType    String

  // Post details
  postUrl           String
  postText          String?
  postAuthorName    String?

  // For comments
  commentText       String?

  // Source
  runId             Int
  searchQuery       String?

  @@unique([personLinkedinUrl, postUrl, engagementType])
}
```

#### Automation

```prisma
model AutomationSession {
  id              Int      @id @default(autoincrement())
  isActive        Boolean  @default(false)
  isLoggedIn      Boolean  @default(false)
  isPaused        Boolean  @default(false)
  linkedinName    String?
  linkedinUrl     String?
  actionsToday    Int      @default(0)
  lastActionAt    DateTime?
}

model ActionQueue {
  id              Int          @id @default(autoincrement())
  actionType      ActionType
  status          ActionStatus @default(PENDING)
  targetUrl       String       // Profile or Post URL
  targetName      String?
  messageText     String?      // For MESSAGE1

  // Campaign link
  campaignId      Int?
  campaignLeadId  Int?

  // Execution
  attempts        Int          @default(0)
  completedAt     DateTime?
  errorMessage    String?
  priority        Int          @default(0)
}

model AutomationSettings {
  id                      Int     @id @default(autoincrement())
  dailyLikeLimit          Int     @default(20)
  dailyConnectLimit       Int     @default(10)
  dailyMessageLimit       Int     @default(10)
  dailyTotalLimit         Int     @default(50)
  minDelayBetweenActions  Int     @default(30)  // seconds
  maxDelayBetweenActions  Int     @default(90)
  workingHoursStart       Int     @default(9)   // 24h format
  workingHoursEnd         Int     @default(18)
  enableRandomPauses      Boolean @default(true)
}
```

#### Campaigns

```prisma
model Campaign {
  id                Int      @id @default(autoincrement())
  name              String

  // Message template with variables: {{firstName}}, {{landingUrl}}
  message1Template  String?
  landingUrl        String?

  // Limits
  invitesPerDay     Int      @default(20)
  messagesPerDay    Int      @default(50)
  workingHoursStart Int      @default(9)
  workingHoursEnd   Int      @default(18)

  // Status & stats
  isActive          Boolean  @default(true)
  totalLeads        Int      @default(0)
  invitedCount      Int      @default(0)
  connectedCount    Int      @default(0)
  messagedCount     Int      @default(0)

  leads             CampaignLead[]
}

model CampaignLead {
  id              Int             @id @default(autoincrement())
  campaignId      Int

  // Profile
  profileUrl      String
  name            String
  firstName       String?
  headline        String?

  // Scoring & funnel
  temperature     LeadTemperature @default(WARM)  // HOT, WARM
  status          LeadStatus      @default(NEW)   // NEW, INVITED, CONNECTED, MSG1, DONE
  notes           String?

  // Timestamps
  createdAt       DateTime        @default(now())
  invitedAt       DateTime?
  connectedAt     DateTime?
  msg1At          DateTime?

  campaign        Campaign @relation(...)

  @@unique([campaignId, profileUrl])
}
```

---

## Features

### 1. Scraping Tab

Create and manage LinkedIn scraping runs:

- **Search Parameters**:
  - Keywords (e.g., "hiring copywriter", "looking for designer")
  - Author profile URLs
  - Company filters
  - Time period: 24h, week, month
  - Max posts limit

- **Options**:
  - Scrape comments (who commented on posts)
  - Scrape reactions (who liked/reacted)

- **Results**:
  - Expandable rows showing comments and reactions
  - Post details, author info, engagement counts
  - Repeat previous runs with same parameters

### 2. Activity Feed Tab

Individual engagement tracking:

- **Data Shown**:
  - Person name, position, LinkedIn URL
  - Action type (LIKE, COMMENT, EMPATHY, etc.)
  - Post they engaged with
  - Comment text (if applicable)

- **Filters**:
  - By action type
  - Search by name, position, keyword
  - Filter by comment content

- **Actions**:
  - Queue LIKE, CONNECT, PROFILE_VIEW
  - Export to CSV

### 3. Automation Tab

#### Sub-tab: Campaigns

Campaign-based outreach management:

- **Create Campaign**:
  - Name
  - Message template (with variables)
  - Landing URL for {{landingUrl}} variable
  - Daily invite/message limits

- **Import Leads**:
  - Select scraping run
  - Import commenters, reactors, or both
  - Deduplication by profile URL

- **Lead Management**:
  - Temperature scoring: HOT / WARM
  - Status funnel: NEW → INVITED → CONNECTED → MSG1 → DONE
  - Bulk status updates
  - Notes per lead

- **Mass Actions**:
  - Queue CONNECT (HOT first)
  - Queue CONNECT (all NEW)
  - Queue MESSAGE1 (for CONNECTED leads)

#### Sub-tab: Browser & Queue

- **Session Status**:
  - Browser active/inactive
  - LinkedIn login status
  - Actions completed today

- **Action Queue**:
  - View pending/completed/failed actions
  - Clear queue
  - Manual queue additions

- **Settings**:
  - Daily limits per action type
  - Delay between actions (min/max)
  - Working hours (AM/PM selector)
  - Random pause settings

---

## API Reference

### Scraping

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scraping/runs` | List runs with pagination |
| POST | `/api/scraping/runs` | Create new run |
| GET | `/api/scraping/runs/[id]` | Get run details |
| GET | `/api/scraping/runs/[id]/results` | Get run results |
| GET | `/api/scraping/runs/[id]/status` | Check Apify status |
| POST | `/api/scraping/runs/[id]/abort` | Abort running job |

### Activity Feed

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements` | List with filters |
| POST | `/api/engagements/backfill` | Extract from results |

### Automation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/session` | Get session status |
| POST | `/api/automation/session` | Update session |
| GET | `/api/automation/queue` | List queued actions |
| POST | `/api/automation/queue` | Add action to queue |
| DELETE | `/api/automation/queue` | Clear queue |
| GET | `/api/automation/settings` | Get settings |
| PUT | `/api/automation/settings` | Update settings |
| GET | `/api/automation/stats` | Today's stats |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/[id]` | Get campaign |
| PUT | `/api/campaigns/[id]` | Update campaign |
| DELETE | `/api/campaigns/[id]` | Delete campaign |
| GET | `/api/campaigns/[id]/leads` | List leads |
| POST | `/api/campaigns/[id]/leads` | Import leads |
| PUT | `/api/campaigns/[id]/leads` | Update leads |
| POST | `/api/campaigns/[id]/leads/queue` | Queue actions |

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon.tech recommended)
- Apify account with API token
- Google Chrome (for automation)

### Environment Variables

Create `.env` file:

```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
APIFY_API_TOKEN="apify_api_xxxxx"
```

### Installation

```bash
# Clone repository
git clone https://github.com/Fedor-K/intent2reach.git
cd intent2reach

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database (first time)
npx prisma db push

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## Browser Automation - How It Works

### Concept

Автоматизация работает через **твой личный Chrome браузер** на твоём Mac. Это НЕ облачный сервис - скрипт управляет реальным браузером, где ты залогинен в LinkedIn.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        КАК РАБОТАЕТ АВТОМАТИЗАЦИЯ                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ТЫ (Mac)                              СЕРВЕР (VPS)                         │
│  ────────                              ────────────                         │
│                                                                             │
│  ┌─────────────────────┐               ┌─────────────────────┐              │
│  │  Chrome Browser     │               │  Web Dashboard      │              │
│  │  (visible window)   │               │  intenttoreach.com  │              │
│  │                     │               │                     │              │
│  │  ┌───────────────┐  │               │  • Create campaigns │              │
│  │  │   LinkedIn    │  │               │  • Import leads     │              │
│  │  │   (твой акк)  │  │               │  • Queue actions    │              │
│  │  └───────────────┘  │               │  • View stats       │              │
│  │         ▲           │               └──────────┬──────────┘              │
│  │         │           │                          │                         │
│  └─────────┼───────────┘                          │                         │
│            │                                      │                         │
│  ┌─────────┼───────────┐                          │                         │
│  │  automation.ts      │                          │                         │
│  │  (Puppeteer script) │                          │                         │
│  │                     │                          ▼                         │
│  │  • Reads queue ─────┼──────────────────► PostgreSQL                      │
│  │  • Moves mouse      │                    (Neon cloud)                    │
│  │  • Clicks buttons   │                          │                         │
│  │  • Types messages   │◄─────────────────────────┘                         │
│  │  • Updates status   │                                                    │
│  └─────────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow Step-by-Step

```
1. WEB DASHBOARD (сервер)
   ├── Ты создаёшь кампанию
   ├── Импортируешь лидов из скрейпинга
   ├── Нажимаешь "Queue CONNECT (HOT first)"
   └── Actions записываются в PostgreSQL (status: PENDING)

2. AUTOMATION SCRIPT (твой Mac)
   ├── Запускаешь: npx tsx scripts/automation.ts
   ├── Открывается Chrome с сохранённым профилем
   ├── Ты логинишься в LinkedIn (один раз, профиль сохраняется)
   └── Скрипт начинает работу

3. EXECUTION LOOP (бесконечный цикл)
   │
   ├── Проверка: залогинен? ──────► Нет → Ждёт логина
   │                    │
   │                    ▼ Да
   ├── Проверка: рабочие часы? ───► Нет → Ждёт до 9:00
   │                    │
   │                    ▼ Да
   ├── Проверка: лимиты? ─────────► Достигнуты → Ждёт завтра
   │                    │
   │                    ▼ Не достигнуты
   ├── Берёт action из очереди (PENDING, ORDER BY priority)
   │                    │
   │                    ▼
   ├── Выполняет action:
   │   │
   │   ├── CONNECT_NO_NOTE:
   │   │   ├── Открывает профиль человека
   │   │   ├── Ищет кнопку Connect (или в More dropdown)
   │   │   ├── Двигает мышь по кривой Безье (human-like)
   │   │   ├── Кликает с рандомным offset
   │   │   ├── Если модальное окно → кликает "Send without note"
   │   │   └── Обновляет status → COMPLETED
   │   │
   │   ├── MESSAGE1:
   │   │   ├── Открывает профиль
   │   │   ├── Кликает Message
   │   │   ├── Подставляет переменные в шаблон:
   │   │   │   "Hi {{firstName}}..." → "Hi John..."
   │   │   ├── Печатает посимвольно (30-80ms между символами)
   │   │   ├── Кликает Send
   │   │   └── Обновляет status → COMPLETED
   │   │
   │   └── LIKE / PROFILE_VIEW / etc.
   │
   ├── Ждёт 30-90 секунд (рандомно)
   │
   ├── Каждые 5-10 actions → пауза 5-15 минут
   │
   └── Повторяет цикл
```

### Why This Architecture?

```
❌ НЕ используем:
   • Облачные браузеры (Browserless, etc.) - дорого, палятся
   • Headless режим - LinkedIn детектит
   • API LinkedIn - нет официального API для outreach
   • Сохранение паролей - небезопасно

✅ Используем:
   • Твой реальный Chrome
   • Твой реальный LinkedIn аккаунт
   • Puppeteer-core (управление существующим браузером)
   • Visible mode (ты видишь что происходит)
   • Persistent profile (логин сохраняется между сессиями)
```

### Anti-Detection Features

```
1. MOUSE MOVEMENT (Bezier Curves)

   Обычный бот:           Наш скрипт:

   Start ──────► End      Start ─╮
                                  ╲
                                   ╲
                                    ╲
                                     ╲
                          End ◄──────╯

   • Криволинейная траектория
   • Скорость меняется (медленнее в начале и конце)
   • Финальный клик со смещением ±3px от центра

2. TYPING
   • Посимвольный ввод (не paste)
   • Случайная задержка 30-80ms между символами
   • Имитация человеческой скорости печати

3. TIMING
   • 30-90 сек между действиями
   • Рандомные паузы на 5-15 минут
   • Только в рабочие часы (настраиваемо)
   • Дневные лимиты (20 connects, 50 messages)

4. BROWSER FINGERPRINT
   • Реальный Chrome (не Puppeteer bundled)
   • Реальный user-agent
   • Persistent cookies и localStorage
   • Нет флагов автоматизации
```

### Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    ЧТО ГДЕ ХРАНИТСЯ                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LinkedIn credentials     → НИГДЕ (ты вводишь руками)          │
│  LinkedIn session         → ~/.intent2reach/chrome-profile/    │
│  Database URL             → .env на твоём Mac                  │
│  Action queue             → PostgreSQL (Neon)                  │
│  Campaign data            → PostgreSQL (Neon)                  │
│  Web dashboard            → VPS сервер                         │
│                                                                 │
│  Риски:                                                        │
│  • Если кто-то получит доступ к твоему Mac → сессия LinkedIn   │
│  • Если кто-то получит DATABASE_URL → данные кампаний          │
│  • LinkedIn credentials → никогда не передаются                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Running Automation

The automation script runs **separately** from the web app. It opens a visible Chrome browser and processes actions from the queue.

### On Mac (Recommended)

```bash
cd intent2reach

# Ensure .env has DATABASE_URL
# Generate Prisma client if schema changed
npx prisma generate

# Run automation
npx tsx scripts/automation.ts
```

### How It Works

1. **Launch**: Script opens Chrome with persistent profile
2. **Navigate**: Goes to linkedin.com
3. **Login**: **You log in manually** (credentials never stored)
4. **Detection**: Script detects login by checking for profile elements
5. **Processing**: Reads queue from database, executes actions
6. **Safety**: Random delays, Bezier mouse curves, working hours

### Action Types

| Action | Description | Notes |
|--------|-------------|-------|
| `LIKE` | Like a post | Finds like button, clicks |
| `CONNECT` | Connection request | Handles direct button or More dropdown |
| `CONNECT_NO_NOTE` | Connect without note | For campaigns |
| `MESSAGE1` | Send first message | Uses template with variables |
| `PROFILE_VIEW` | View profile | Scrolls for engagement |

### Safety Features

```
Human-like Mouse Movement
├── Bezier curves (not linear paths)
├── Variable speed (slower at start/end)
├── Random final offset (doesn't click exact center)
└── Natural arc patterns

Timing Protection
├── 30-90 second delay between actions
├── Random pauses every 5-10 actions
├── Working hours enforcement
└── Daily limits per action type

Detection Avoidance
├── Persistent Chrome profile (no automation flags)
├── Real user agent string
├── No headless mode (visible browser)
└── Manual login (no stored credentials)
```

---

## Deployment

### Deploy to Server

```bash
ssh root@198.12.73.168
cd /var/www/intent2reach

# Pull latest changes
git pull origin claude/apify-actor-service-eDOKE

# Install dependencies
npm install

# Update database schema (if changed)
npx prisma db push

# Build production
npm run build

# Restart PM2
pm2 restart all
```

### Server Commands

```bash
# View logs
pm2 logs intent2reach --lines 100

# Check status
pm2 status

# Restart
pm2 restart all

# Force update (discard local changes)
git fetch origin
git reset --hard origin/claude/apify-actor-service-eDOKE
npm install && npx prisma db push && npm run build && pm2 restart all
```

### Nginx Configuration

Located at `/etc/nginx/sites-available/intent2reach`:

```nginx
server {
    listen 80;
    server_name intenttoreach.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name intenttoreach.com;

    ssl_certificate /etc/letsencrypt/live/intenttoreach.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/intenttoreach.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Troubleshooting

### "No actions in queue" but queue shows pending

Prisma client doesn't know about new ActionTypes. Regenerate:

```bash
npx prisma generate
# Then restart automation script
```

### Connection request not sending

LinkedIn UI changes frequently. The script handles multiple patterns:

1. Direct Connect button on profile
2. Connect inside "More" dropdown
3. "Send without a note" modal

Check browser console for errors. Script logs button detection.

### Import shows 0 leads

Different Apify data structures. The `extractPersonInfo` function checks:
- `item.author`
- `item.actor`
- `item.user`
- Direct item properties

Check raw data in `ScrapingResult.rawData`.

### Automation not running within working hours

Check `AutomationSettings.workingHoursStart` and `workingHoursEnd` (24h format). Script logs when outside working hours.

### Database connection errors

Verify `DATABASE_URL` in `.env`. For Neon, ensure `?sslmode=require` is appended.

---

## Development Notes

### Adding New Action Types

1. Add to `ActionType` enum in `prisma/schema.prisma`
2. Run `npx prisma db push`
3. Run `npx prisma generate`
4. Add handler in `scripts/automation.ts` switch statement
5. Add UI in `AutomationPanel.tsx` or `CampaignLeadsPanel.tsx`

### Adding New API Routes

1. Create file in `src/app/api/[route]/route.ts`
2. Export async functions: `GET`, `POST`, `PUT`, `DELETE`
3. Use `prisma` client from `@/lib/db`

### Modifying Database Schema

1. Edit `prisma/schema.prisma`
2. Run `npx prisma db push` (development)
3. Or `npx prisma migrate dev` (creates migration file)
4. Run `npx prisma generate` to update client

---

## Contributing

1. Create feature branch from `claude/apify-actor-service-eDOKE`
2. Make changes
3. Test locally with `npm run dev`
4. Push to branch
5. Deploy to server and verify

---

## License

Private project - All rights reserved.
