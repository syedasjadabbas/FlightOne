# FlightOne AI-TOS

Autonomous Travel Operating System (AI-TOS) v1.0.

## Repository Structure

```
FlightOne-AI-TOS/
├── client/     # Next.js 15 App Router Frontend & Conversational Workspace
├── server/     # Express + Prisma + PostgreSQL Modular Domain Backend
└── docs/       # Architecture & Software Design Specifications (SDS v1.0)
    └── FlightOne_AI-TOS_SDS_v1.0.pdf
```

## Quick Start

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
