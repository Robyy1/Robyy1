# Keystroke

A production-ready typing speed website built for typing real code across multiple programming languages, alongside a standard general-text mode.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite via `better-sqlite3` (file-based, zero external services)
- **Auth:** bcrypt password hashing + JWT in httpOnly cookie
- **Frontend:** Plain HTML + CSS + vanilla JavaScript (ES modules), no bundler or build step

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm (comes with Node.js)

### Installation

```bash
npm install
```

### Environment Variables

Copy the example environment file and adjust as needed:

```bash
cp .env.example .env
```

Required variables in `.env`:

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Environment (`development`, `production`, or `test`) | `development` |
| `JWT_SECRET` | Secret key for signing JWT tokens (must be at least 32 characters) | required |
| `DB_PATH` | SQLite database path | `./data/keystroke.db` |
| `BCRYPT_COST` | bcrypt cost factor | `12` |

### Running Locally

```bash
npm start
```

The server starts on the port specified in `.env` (default: 3000). Open `http://localhost:3000` in your browser.

On first run, the database is initialized automatically from `db/schema.sql` and populated with sample data from `data/quotes.json` and `data/code-snippets.json`. Course data is seeded from `data/courses.json` when the `courses` table is empty.

> **Upgrading an existing database:** `db/db.js` runs a lightweight migration system on every boot (tracked with SQLite's `PRAGMA user_version`). It is non-destructive: existing rows are kept, new columns are added, and new tables (`courses`, `lessons`, `user_lesson_progress`) are created automatically. If you need to re-seed course data, run `npm run seed`.

## Database migrations

Migrations live in the `migrations/` directory and follow numeric, one-way ordering. For a fresh app, the app boot path is already idempotent. For a production upgrade, run the migration sequence in order:

```bash
npm run migrate
```

If a migration file is missing or the database is already up to date, the runner exits cleanly.

## Database backups and integrity checks

Create a backup:

```bash
npm run backup-db
```

Check DB integrity:

```bash
npm run check-db-integrity
```

## Project Structure

```
keystroke/
├── server.js                 # Express application entry point
├── package.json
├── .env.example              # Environment variable template
├── .gitignore
├── README.md
├── db/
│   ├── schema.sql            # Database schema (tables, indexes)
│   ├── db.js                 # SQLite connection + migration runner
│   └── seed.js               # Seeds database on first run
├── migrations/
│   └── 001_initial_schema.sql
├── scripts/
│   ├── backup-db.js          # Backup script for cron jobs
│   ├── check-db-integrity.js # Integrity check
│   └── run-migrations.js     # Migration runner
├── data/
│   ├── quotes.json           # 70 general-text passages
│   ├── code-snippets.json    # 96 real code snippets across 8 languages
│   └── courses.json          # 6 courses / 58 lessons for Learning mode
├── routes/
│   ├── auth.js               # Signup, login, logout, me endpoints
│   ├── texts.js              # Random text/snippet retrieval
│   ├── results.js            # Save and fetch typing results
│   ├── leaderboard.js        # Global rankings with filters
│   ├── learning.js           # Courses, lessons, attempts, read-marks
│   └── user.js               # User settings, password, account deletion, export
├── middleware/
│   ├── auth.js               # JWT verification middleware
│   └── errorHandler.js       # Centralized Express error handler
└── public/
    ├── index.html             # Landing page with live demo
    ├── login.html             # Login form
    ├── signup.html            # Signup form
    ├── type.html              # Typing test interface
    ├── learning.html          # Course grid / learning hub
    ├── course.html            # Lesson list for one course
    ├── lesson.html            # Type or read a lesson
    ├── dashboard.html         # Personal stats and charts
    ├── leaderboard.html       # Global rankings
    ├── settings.html          # Theme, font, account settings
    ├── 404.html               # Branded 404 page
    ├── css/
    │   ├── tokens.css         # Design tokens / CSS custom properties
    │   ├── base.css           # Reset and base styles
    │   ├── components.css     # Reusable UI components
    │   └── pages.css          # Page-specific styles
    └── js/
        ├── theme.js           # Theme switching (dark/light)
        ├── auth-client.js     # Client-side auth helpers
        ├── typing-engine.js   # Core typing engine logic
        ├── stats.js           # WPM/accuracy math + chart rendering
        ├── dashboard.js       # Dashboard page logic
        ├── leaderboard.js     # Leaderboard page logic
        ├── learning.js        # Learning hub logic
        ├── course.js          # Course page logic
        ├── lesson.js          # Lesson page logic
        └── settings.js        # Settings page logic
```

## API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Create account | No |
| `POST` | `/api/auth/login` | Login | No |
| `POST` | `/api/auth/logout` | Logout | Yes |
| `GET` | `/api/auth/me` | Current user info | Yes |
| `GET` | `/api/texts/random?mode=code&language=python&difficulty=intermediate` | Get random text/snippet | No |
| `POST` | `/api/results` | Save typing result | Optional |
| `GET` | `/api/results/me` | User's result history | Yes |
| `GET` | `/api/leaderboard?mode=code&language=python&period=week` | Global rankings | No |
| `PUT` | `/api/user/settings` | Update theme/font/accent/learning preferences | Yes |
| `PUT` | `/api/user/password` | Change password | Yes |
| `GET` | `/api/user/export` | Download full data export (results + learning progress) | Yes |
| `DELETE` | `/api/user/me` | Delete account | Yes |
| `GET` | `/api/courses` | List courses + learning summary | Optional |
| `GET` | `/api/courses/:slug` | Course detail with lesson lock states | Optional |
| `GET` | `/api/lessons/:id` | Lesson content (403 if prior lesson incomplete) | Optional |
| `POST` | `/api/lessons/:id/attempt` | Submit a typed attempt (pass/fail gate) | Optional |
| `POST` | `/api/lessons/:id/mark-read` | Complete a lesson in read mode | Optional |

## Features

- **Code mode:** Type real code snippets across 8 languages (JavaScript, Python, Java, C++, Go, Rust, TypeScript, SQL) at three difficulty levels.
- **General text mode:** Standard typing passages with varied character sets.
- **Live stats:** Real-time WPM, raw WPM, accuracy, and consistency during tests.
- **Dashboard:** Personal WPM-over-time charts (hand-rolled SVG), personal bests, recent results table.
- **Leaderboard:** Global rankings filterable by mode, language, and time period.
- **Settings:** Dark/light theme toggle, accent color picker, monospace font selector with live preview, reduce-motion control, learning mode, indent width, sound toggle, and account management (email, password, JSON data export, account deletion).
- **Learning mode:** 6 courses / 58 lessons across JavaScript, Python, Git & CLI, SQL, Regex, and AI Prompting. Lessons unlock sequentially; type the snippet to pass (accuracy gate) or read it to mark complete. Progress persists per account.
- **Optional auth:** Guests can type without logging in; results and learning progress persist when authenticated.

## Deployment

Keystroke is designed for straightforward deployment to any platform that supports Node.js applications:

**Render / Railway / VPS:** Push the repository and point the platform's service at `server.js` as the start command (`npm start`). Since the database is a file-based SQLite store, ensure your hosting provider mounts persistent disk storage (Render's free tier uses ephemeral disk by default — use a paid plan or an external SQLite host for data persistence across deployments). Set `NODE_ENV=production`, `PORT` to the platform-assigned port, and a strong `JWT_SECRET`.

**Docker:** A simple `Dockerfile` can be added with `node:18-alpine` as the base, copying the project files, running `npm install --production`, and starting with `npm start`. Expose the configured PORT.

## Keyboard Accessibility

All interactive elements are reachable via Tab navigation with visible focus rings. The typing test uses a hidden input field to capture keystrokes reliably across desktop and mobile (on-screen keyboard). Escape key closes modals on settings pages. Accent swatches and segmented controls support arrow-key navigation. The reduce-motion setting can force animations off for accessibility.
