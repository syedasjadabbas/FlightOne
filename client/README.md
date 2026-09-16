<div align="center">

# ✈️ FlightOne

### AI-First Travel Operating System

**Plan. Compare. Book. Manage. Travel.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-RTK_Query-764ABC?logo=redux&logoColor=white)](https://redux-toolkit.js.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Private-lightgrey)]()

</div>

---

## Overview

**FlightOne** is an AI-first travel platform built around **Ava**, an intelligent AI travel consultant.

Instead of forcing travellers to search across multiple systems, FlightOne brings the complete travel lifecycle into one experience:

> **Discover → Compare → Decide → Book → Manage → Travel**

Ava understands natural-language requests, learns traveller preferences, presents curated options, assists with booking decisions, and continues helping throughout the journey.

The platform is designed as a complete **Travel Operating System**, not simply a flight-search interface or chatbot.

---

## ✨ Core Experience

```text
                    ┌───────────────────────┐
                    │        AVA AI         │
                    │  Travel Consultant    │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
   DISCOVERY                DECISION                 ACTION
        │                       │                       │
        ▼                       ▼                       ▼
  Flights + Hotels       AI Recommendations       Booking
  Visa Context           Preference Learning       Payments
  Alternatives           Price Intelligence        Ticketing
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                       JOURNEY MANAGEMENT
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
          Updates           Documents          Support
          Alerts            Vault              Servicing
```

---

## 🧠 Ava AI

Ava is the conversational intelligence layer of FlightOne.

### What Ava does

- Understands natural-language travel requests
- Maintains conversation context
- Handles follow-up questions
- Refines searches based on traveller preferences
- Recommends instead of overwhelming users with listings
- Explains why an option is recommended
- Learns preferences from traveller interactions
- Uses traveller profile information when appropriate
- Connects booking, visa, journey and servicing workflows
- Escalates complex requests to human operations

### Example

```text
User:
"I need to reach Dubai next weekend.
Keep it affordable but avoid long layovers."

Ava:
"I found several options. I'd recommend these three:

1. Emirates
   Best overall balance of time + price

2. Qatar Airways
   Shorter journey with one connection

3. Airblue + partner connection
   Lowest price, but a longer total journey

Want me to optimize for price, comfort, or arrival time?"
```

---

# 🎯 Platform Capabilities

| Capability | Description |
|---|---|
| 🤖 AI Travel Consultant | Conversational travel planning with Ava |
| ✈️ Flight Search | Galileo / Travelport powered flight workflows |
| 🏨 Hotel Search | RateHawk hotel inventory |
| 🧠 Recommendations | AI-ranked and preference-aware options |
| 💳 Pricing | Dynamic markup and margin-aware pricing |
| 👤 Traveller Profiles | Passport, visa, loyalty and travel preferences |
| 📁 Travel Vault | Secure travel documents and booking artifacts |
| 🛂 Visa Assistance | Destination and transit visa guidance |
| 🏢 Corporate Travel | Policies, approvals, departments and cost centres |
| 🎫 Ticketing | Reservation, ticketing and travel document workflows |
| 🔁 Refunds & Reissues | Refund calculation and servicing workflows |
| 📡 Journey Monitoring | Travel status, disruptions and notifications |
| 👥 Groups | Group itineraries, collaboration and live updates |
| 🎤 MICE | Meetings, incentives, conferences and exhibitions |
| 🎁 Rewards | Credits, referrals and loyalty |
| 🧑‍💼 Human Escalation | AI-to-human support handoff |
| 📊 Operations | CRM, finance, reconciliation and analytics |

---

# 🖥️ Client Application

The FlightOne client is built with a modern **Next.js App Router** architecture.

### Main user experiences

```text
/                         Landing / Entry
/chat                     Ava AI Consultant
/search                   Travel Search
/results                  Search Results
/checkout                 Booking & Payment
/profile                  Traveller Profile
/vault                    Travel Documents
/visa                     Visa Assistance
/groups                   Group Travel
/groups/[groupId]         Group Workspace
/mice                     MICE Management
/rewards                  Rewards & Credits
/journeys                 Journey Monitoring
/bookings                 Booking Management
```

---

# 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      FlightOne Client                       │
│                                                             │
│  Next.js App Router + TypeScript + Tailwind CSS            │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ Pages / UI  │  │ Client State │  │ Server State      │ │
│  │             │  │ Zustand      │  │ RTK Query         │ │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬─────────┘ │
│         │                 │                    │            │
└─────────┼─────────────────┼────────────────────┼────────────┘
          │                 │                    │
          └─────────────────┴────────────────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   FlightOne API     │
                 │ Express + Prisma    │
                 └──────────┬──────────┘
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
      PostgreSQL         Suppliers          Services
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        Galileo / Travelport       RateHawk
```

---

# 🧩 Frontend Architecture

FlightOne follows a domain-oriented client architecture designed for maintainability and scalability.

### Server state

**RTK Query** handles:

- API requests
- Caching
- Invalidations
- Loading states
- Error states
- Server synchronization

### UI state

**Zustand** handles lightweight client-side state such as:

- UI preferences
- Temporary interaction state
- Local workflow state
- Non-server application state

### API structure

The client uses a shared API foundation with feature-specific endpoint injection.

```text
src/
├── app/
│   ├── chat/
│   ├── search/
│   ├── checkout/
│   ├── profile/
│   ├── vault/
│   ├── visa/
│   ├── groups/
│   ├── mice/
│   ├── rewards/
│   └── journeys/
│
├── components/
├── features/
├── lib/
├── hooks/
├── store/
└── services/
```

---

# 🎨 UI Philosophy

FlightOne focuses on a **decision-oriented travel experience**.

Instead of:

```text
100+ search results
        ↓
Traveller compares everything
        ↓
Decision fatigue
```

FlightOne aims for:

```text
User intent
     ↓
Ava understands
     ↓
Relevant options
     ↓
AI ranking
     ↓
Clear recommendation
     ↓
Confident decision
```

The interface is designed around:

- Clear hierarchy
- Fast decisions
- Contextual recommendations
- Minimal unnecessary steps
- Responsive interactions
- Consistent reusable components

---

# 🔐 Security

Security is treated as a first-class part of the client architecture.

### Authentication

- Access-token based authentication
- Secure refresh-token flow
- Session management
- Logout and session revocation

### Application security

- Permission-aware UI
- Protected routes
- Role-based feature visibility
- API authorization boundaries
- Secure handling of sensitive profile data
- No client exposure of secret environment variables

Sensitive credentials and supplier secrets remain server-side.

---

# 🔌 Integrations

FlightOne is designed around supplier abstraction so additional providers can be introduced without rewriting the client experience.

### Current integrations

| Integration | Purpose |
|---|---|
| Galileo / Travelport | Flight inventory and booking workflows |
| RateHawk | Hotel inventory and booking |
| Stripe | Payment infrastructure |

### Planned ecosystem

```text
Amadeus
Sabre
NDC
Airline Direct
Hotelbeds
WebBeds
Expedia Partner Solutions
Viator
Travel Insurance
Airport Transfers
```

---

# 📱 Responsive Experience

FlightOne is designed for modern travel usage across:

```text
Desktop
   │
   ├── Dashboard
   ├── Search
   ├── Booking
   └── Operations

Tablet
   │
   ├── Search
   ├── Planning
   └── Booking

Mobile
   │
   ├── Ava
   ├── Trips
   ├── Documents
   └── Notifications
```

---

# ⚙️ Getting Started

## Prerequisites

Make sure you have:

- Node.js 20+
- npm
- Access to the FlightOne API
- Required environment configuration

## Installation

```bash
git clone https://github.com/syedasjadabbas/FlightOne-Client.git

cd FlightOne-Client

npm install
```

## Environment

Create a local environment file:

```bash
cp .env.example .env.local
```

Configure the required client-side variables.

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

> Never commit secrets or private credentials to the repository.

## Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# 🧪 Quality

The client uses automated testing to protect application behavior.

```text
Vitest
  │
  ├── Components
  ├── Hooks
  ├── State
  ├── API behavior
  └── Feature workflows
```

Build verification:

```bash
npm run build
```

Testing:

```bash
npm run test
```

---

# 🚀 Development Principles

### Think before searching

Understand user intent before making assumptions.

### Recommend instead of listing

Surface the best options rather than overwhelming travellers.

### Learn continuously

Use explicit and implicit signals to improve recommendations.

### Remember preferences

Traveller context should improve future interactions.

### Escalate intelligently

Complex or sensitive requests should reach human operators.

### Keep humans in control

Automation should assist people, not remove necessary oversight.

---

# 🗺️ Product Roadmap

### Phase 1

- Ava AI Chat
- Galileo / Travelport
- RateHawk
- Traveller Profiles
- Pricing
- Payments
- Corporate Approvals
- Ticketing
- Vouchers

### Phase 2

- Visa Vault
- Rewards
- Groups
- MICE
- Refund Automation
- Journey Monitoring

### Phase 3

- Voice Concierge
- Autonomous Concierge
- Predictive Recommendations
- White-label Corporate Travel
- Expense Management
- Carbon Intelligence
- Advanced Analytics

---

# 📂 Related Repository

FlightOne uses a separate backend service:

**FlightOne Server**

```text
https://github.com/syedasjadabbas/FlightOne-Server
```

---

# 👨‍💻 Project

**FlightOne**  
AI-First Travel Operating System

Built with:

**Next.js · TypeScript · RTK Query · Zustand · Tailwind CSS**

---

<div align="center">

### ✈️ Travel should feel simple.

**FlightOne makes it intelligent.**

</div>
