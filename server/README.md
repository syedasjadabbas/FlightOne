# ✈️ FlightOne Server

### AI-First Travel Operating System Backend

FlightOne Server is the backend platform powering **FlightOne** and **Ava**, an AI-first travel operating system designed to manage the complete travel lifecycle from discovery and recommendations to booking, servicing, journey monitoring, and operations.

The backend provides the business logic, supplier integrations, authentication, pricing, payments, corporate workflows, travel documents, notifications, and operational services required by the FlightOne ecosystem.

> **Powering intelligent travel from search to journey completion.**

---

## 🚀 Core Capabilities

### 🤖 AI Travel Platform
- Ava AI travel consultant services
- Conversational travel workflows
- Context-aware recommendations
- Traveller preference learning
- AI-assisted booking decisions
- Human escalation and servicing handoff

### ✈️ Travel Search & Booking
- Galileo / Travelport flight integration
- RateHawk hotel integration
- Multi-supplier offer normalization
- Offer comparison and ranking
- Flight reservation and ticketing workflows
- Hotel reservation and voucher workflows
- Booking lifecycle management

### 🧠 Recommendations & Pricing
- Preference-aware recommendation ranking
- Airline and supplier quality signals
- Dynamic flight and hotel markups
- Margin-aware pricing
- Corporate pricing rules
- Agent discount controls
- Pricing and profitability safeguards

### 👤 Traveller Management
- Traveller profiles
- Passport and identity information
- Visa and travel preferences
- Loyalty and frequent-flyer information
- Travel history
- Companion and family information
- Document expiry tracking
- Secure travel document vault
- OCR integration abstraction

### 🏢 Corporate Travel
- Company accounts
- Departments and cost centres
- Travel policies
- Approval workflows
- Corporate credit limits
- Corporate billing and invoicing
- Project codes
- Role-based permissions
- Corporate and personal travel separation

### 💳 Payments & Servicing
- Payment workflows
- Booking authorization
- Refund calculations
- Refund processing workflows
- Reissue and exchange servicing
- Travel credits
- Supplier penalties and agency fees
- Idempotent booking operations

### 🛂 Visa & Journey Services
- Visa requirement workflows
- Destination and transit guidance
- Document checklists
- Visa expiry reminders
- Journey monitoring
- Flight status events
- Travel disruption handling
- Weather and travel advisories
- Notification workflows

### 👥 Groups & MICE
- Group travel management
- Invitations and shared itineraries
- Group announcements
- Polls and attendance
- Emergency broadcasts
- Group documents
- MICE events
- Delegates and registrations
- Agendas
- QR check-in
- Badges and attendance
- Budgets and sponsors
- Reports

### 🎁 Rewards
- Rewards ledger
- Booking credits
- Referral rewards
- Corporate rewards
- Loyalty tiers
- Reward expiry
- Checkout credit application

### 📊 Operations
- CRM integration boundaries
- Mid-office workflows
- Back-office operations
- Accounting and finance
- Commissions
- Reconciliation
- Audit logging
- Operational analytics
- KPI dashboards
- Knowledge management

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │   FlightOne Client   │
                         │       Next.js        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                    ┌────────────────────────────┐
                    │      FlightOne Server      │
                    │   Express + TypeScript     │
                    └─────────────┬──────────────┘
                                  │
          ┌───────────────────────┼────────────────────────┐
          │                       │                        │
          ▼                       ▼                        ▼
   ┌─────────────┐        ┌─────────────┐        ┌──────────────┐
   │   Business  │        │ Supplier    │        │ Background   │
   │   Modules   │        │ Integrations│        │   Workers    │
   └──────┬──────┘        └──────┬──────┘        └──────┬───────┘
          │                       │                      │
          ▼                       ▼                      ▼
     PostgreSQL             Galileo / Travelport      Notifications
                            RateHawk                  Journey Jobs
                            Payment Providers         Outbox Jobs
```

---

## 🧩 Backend Architecture

FlightOne Server follows a modular domain-oriented architecture.

```text
Request
   │
   ▼
Route
   │
   ▼
Middleware
(Auth / Permission / Validation)
   │
   ▼
Controller
   │
   ▼
Service
   │
   ├──────────────► Supplier Integration
   │
   ├──────────────► External Service
   │
   ▼
Prisma
   │
   ▼
PostgreSQL
```

### Architectural Principles

- Thin controllers
- Business logic inside services
- Routes do not directly access Prisma
- Zod request validation
- Centralized application errors
- Global error handling
- Permission-based authorization
- Company-scoped access control
- Explicit database selections
- SQL-backed aggregations where appropriate
- Idempotent critical operations
- Background workers for asynchronous workflows
- Supplier adapters with explicit failure states

---

## 🔐 Security

Security is built into the backend architecture.

### Authentication

- Short-lived access tokens
- Refresh-token rotation
- Token family tracking
- Replay detection
- Session management
- Individual session revocation
- Global session revocation
- Password recovery
- Password reset token hashing
- Authentication audit logs

### Authorization

- Role-based access control
- Permission-based API protection
- Company-scoped authorization
- Explicit global permissions
- Resource ownership checks
- IDOR protection
- Protected administrative workflows

### Data Protection

- Sensitive information remains server-side
- Secure document handling
- Encrypted vault abstraction
- Environment-based secrets
- Production configuration validation
- Sanitized operational payloads

---

## 🔌 Supplier Integrations

FlightOne uses adapter-based integrations so external providers remain isolated from core business logic.

### Current

| Integration | Purpose |
|---|---|
| **Galileo / Travelport** | Flight search, pricing, reservation and ticketing |
| **RateHawk** | Hotel search, pricing and booking |
| **Stripe** | Payment processing |

### External / Optional Services

```text
OCR Providers
Visa / Timatic Data
CRM
Email
WhatsApp
Weather Services
Flight Status Providers
Airport Transfer Providers
```

External services use explicit configuration states so the system can fail safely instead of presenting simulated or fabricated live data.

---

## 🗄️ Data Layer

FlightOne Server uses:

**PostgreSQL + Prisma ORM**

The database supports the platform's major domains including:

```text
Users
Profiles
Companies
Bookings
Offers
Payments
Documents
Visa
Rewards
Groups
MICE
Journey Monitoring
Notifications
Escalations
Refunds
Knowledge
Audit Logs
Operations
```

Database access follows explicit selection and company/resource isolation patterns.

---

## ⚙️ Background Processing

Background workers handle asynchronous platform operations such as:

- Notification delivery
- Journey monitoring
- Document expiry checks
- Reward expiry
- CRM synchronization
- Operational outbox processing
- Scheduled servicing tasks
- Travel status updates

The outbox pattern is used where reliable asynchronous delivery is required.

---

## 📁 Project Structure

```text
src/
├── modules/
│   ├── ai/
│   ├── bookings/
│   ├── corporate/
│   ├── flights/
│   ├── hotels/
│   ├── profiles/
│   ├── pricing/
│   ├── payments/
│   ├── visa/
│   ├── rewards/
│   ├── groups/
│   ├── mice/
│   ├── journeys/
│   ├── refunds/
│   ├── escalations/
│   ├── knowledge/
│   └── operations/
│
├── middleware/
├── integrations/
├── workers/
├── routes/
├── lib/
└── prisma/
```

> The exact folder structure may evolve as individual domains grow.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js** | Backend runtime |
| **Express** | API framework |
| **TypeScript** | Type-safe development |
| **Prisma** | Database ORM |
| **PostgreSQL** | Primary database |
| **Zod** | Request validation |
| **PM2** | Process management |
| **Vitest** | Automated testing |

---

## ⚙️ Getting Started

### Requirements

- Node.js 20+
- npm
- PostgreSQL
- Required supplier/API credentials where applicable

### Installation

```bash
git clone https://github.com/syedasjadabbas/FlightOne-Server.git
cd FlightOne-Server
npm install
```

### Environment

Create your environment file and configure the required database, authentication, supplier, payment, and service variables.

Example:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/flightone
JWT_SECRET=your-secret
```

Never commit secrets to Git.

### Database

```bash
npx prisma generate
npx prisma migrate dev
```

### Run Development Server

```bash
npm run dev
```

---

## 🧪 Testing

Run the backend test suite with:

```bash
npm test
```

The test suite covers core business workflows including authentication, permissions, bookings, pricing, refunds, recommendations, corporate workflows, and integrations.

---

## 🔗 FlightOne Client

The backend is consumed by the FlightOne web application:

**FlightOne Client**

https://github.com/syedasjadabbas/FlightOne-Client

---

## 🗺️ Roadmap

### Phase 1
- Ava AI Chat
- Galileo / Travelport
- RateHawk
- Profiles
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

<div align="center">

# ✈️ FlightOne Server

**The backend powering intelligent travel.**

**Plan. Compare. Book. Manage. Travel.**

</div>
