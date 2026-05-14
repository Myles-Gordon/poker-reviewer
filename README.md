# 🃏 Poker Reviewer

A Chess.com-style session reviewer for PokerNow games. Upload your PokerNow CSV log, pick your player name, and get an AI-powered review with:

- **Session score** (0–100) and letter grade
- **Blunders, inaccuracies & missed opportunities** with explanations
- **Bet sizing analysis** — flags min-raises, tiny bets, massive overbets
- **Strategic leaks** — patterns across the session
- **VPIP / PFR / W$SD** stats with benchmarks
- **Coaching tip** for your next session

---

## Setup

### Prerequisites
- Node.js 18+
- An Anthropic API key ([get one here](https://console.anthropic.com))

### 1. Clone / download the project

```bash
cd poker-reviewer
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

### 3. Install dependencies

```bash
# Install root + all workspaces
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 4. Run in development

```bash
npm run dev
```

This starts:
- **Backend** on `http://localhost:3001`
- **Frontend** on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

## How to export from PokerNow

1. Go to your PokerNow game room
2. Click **Ledger** in the top menu
3. Click **Download Full Log** (CSV)
4. Upload that file to Poker Reviewer

---

## Project Structure

```
poker-reviewer/
├── server/
│   ├── index.js      # Express API server
│   ├── parser.js     # PokerNow CSV → structured hands
│   └── analyzer.js   # Claude AI session analysis
├── client/
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── components/
│       │   ├── Upload.jsx
│       │   ├── PlayerSelect.jsx
│       │   ├── Dashboard.jsx
│       │   ├── MistakeCard.jsx
│       │   └── SizingBreakdown.jsx
│       └── styles/global.css
└── .env.example
```

---

## Planned Features

- [ ] Positional leak detection (VPIP/PFR by position)
- [ ] Hand-by-hand timeline scrubber
- [ ] Multi-session comparison
- [ ] Hero auto-detection
- [ ] PDF export of review
