# FlightOne AI-TOS

Autonomous Travel Operating System (AI-TOS) v1.0.

## Repository Structure

```
flightone/
├── client/          # Next.js 16 App Router Frontend & Conversational Workspace
├── server/          # Express + Prisma + PostgreSQL Modular Domain Backend
├── docs/            # Architecture & Software Design Specifications (SDS v1.0)
│   ├── FlightOne_AI-TOS_SDS_v1.0.pdf
│   └── modules/     # Individual module architectural specifications
├── .gitignore       # Repository ignore rules
├── package.json     # Monorepo workspace configuration
└── README.md        # Repository overview & setup instructions
```

## Quick Start

### Root Workspace Commands
```bash
# Run both backend and frontend tests
npm test

# Run dev servers
npm run dev:server
npm run dev:client
```

### Client Setup
```bash
cd client
npm install
npm run dev
```

### Server Setup
```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm start
```

