# Poker Reviewer

A Chess.com-style session reviewer for PokerNow games. Upload your PokerNow CSV log, pick your player name, and get an AI-powered hand-by-hand review with a built-in coaching chat.

## Features

- **Session analysis** — score (0–100), letter grade, blunders, inaccuracies, missed opportunities
- **Hand replayer** — step through each hand street by street with action history
- **Hand coach** — ask Claude anything about a specific hand: ranges, bet sizing, pot odds
- **Bet sizing analysis** — flags min-raises, tiny bets, and overbets
- **Strategic leaks** — patterns detected across your session
- **Stats** — VPIP, PFR, W$SD with benchmarks

---

## Setup

### Prerequisites

- Node.js 18+
- An Anthropic API key ([get one here](https://console.anthropic.com))

### 1. Clone the repo

```bash
git clone https://github.com/Myles-Gordon/poker-reviewer.git
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
npm install
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

## Exporting from PokerNow

1. Go to your PokerNow game room
2. Click **Ledger** in the top menu
3. Click **Download Full Log** (CSV)
4. Upload that file to Poker Reviewer

---

## Project Structure

```
poker-reviewer/
├── server/
│   ├── index.js          # Express API + hand context builder
│   ├── parser.js         # PokerNow CSV → structured hands
│   └── analyzer.js       # Claude session analysis
├── client/
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── components/
│           ├── Upload.jsx
│           ├── PlayerSelect.jsx
│           ├── Dashboard.jsx
│           ├── HandsTab.jsx      # Hand replayer + coach layout
│           ├── HandReplayer.jsx
│           └── HandChat.jsx      # Per-hand coaching chat
└── .env.example
```
