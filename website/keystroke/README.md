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
| `JWT_SECRET` | Secret key for signing JWT tokens (use a long random string) | `keystroke-secret-change-me` |
| `NODE_ENV` | Environment (`development` or `production`) | `development` |

### Running Locally

```bash
npm start
```

The server starts on the port specified in `.env` (default: 3000). Open `http://localhost:3000` in your browser.

On first run, the database is initialized automatically from `db/schema.sql` and populated with sample data from `data/quotes.json` and `data/code-snippets.json`.

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
│   ├── db.js                 # SQLite database connection wrapper
│   └── seed.js               # Seeds database on first run
├── data/
│   ├── quotes.json           # 50+ general-text passages
│   └── code-snippets.json    # 190+ real code snippets across 8 languages
├── routes/
│   ├── auth.js               # Signup, login, logout, me endpoints
│   ├── texts.js              # Random text/snippet retrieval
│   ├── results.js            # Save and fetch typing results
│   ├── leaderboard.js        # Global rankings with filters
│   └── user.js               # User settings, password, account deletion
├── middleware/
│   ├── auth.js               # JWT verification middleware
│   └── errorHandler.js       # Centralized Express error handler
└── public/
    ├── index.html             # Landing page with live demo
    ├── login.html             # Login form
    ├── signup.html            # Signup form
    ├── type.html              # Typing test interface
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
| `PUT` | `/api/user/settings` | Update theme/font preferences | Yes |
| `PUT` | `/api/user/password` | Change password | Yes |
| `DELETE` | `/api/user/me` | Delete account | Yes |

## Features

- **Code mode:** Type real code snippets across 8 languages (JavaScript, Python, Java, C++, Go, Rust, TypeScript, SQL) at three difficulty levels.
- **General text mode:** Standard typing passages with varied character sets.
- **Live stats:** Real-time WPM, raw WPM, accuracy, and consistency during tests.
- **Dashboard:** Personal WPM-over-time charts (hand-rolled SVG), personal bests, recent results table.
- **Leaderboard:** Global rankings filterable by mode, language, and time period.
- **Settings:** Dark/light theme toggle, monospace font selector with live preview, account management.
- **Optional auth:** Guests can type without logging in; results persist when authenticated.

## Deployment

Keystroke is designed for straightforward deployment to any platform that supports Node.js applications:

**Render / Railway / VPS:** Push the repository and point the platform's service at `server.js` as the start command (`npm start`). Since the database is a file-based SQLite store, ensure your hosting provider mounts persistent disk storage (Render's free tier uses ephemeral disk by default — use a paid plan or an external SQLite host for data persistence across deployments). Set `NODE_ENV=production`, `PORT` to the platform-assigned port, and a strong `JWT_SECRET`.

**Docker:** A simple `Dockerfile` can be added with `node:18-alpine` as the base, copying the project files, running `npm install --production`, and starting with `npm start`. Expose the configured PORT.

## Keyboard Accessibility

All interactive elements are reachable via Tab navigation with visible focus rings. The typing test uses a hidden input field to capture keystrokes reliably across desktop and mobile (on-screen keyboard). Escape key closes modals on settings pages.
