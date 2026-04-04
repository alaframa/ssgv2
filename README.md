# 🔵 SSG v2 — LPG Distributor Management System

> A full-stack operations platform for LPG gas cylinder distributors — built to handle the full lifecycle from supplier procurement, warehouse management, cylinder dispatch & tracking, delivery orders, to customer cashback (GasBack) programs.

---

## 🧠 About This Project

**SSG v2** is a modern internal operations system built for LPG (Liquefied Petroleum Gas) distributors operating across multiple branches. It replaces manual spreadsheets and fragmented tools with a unified, role-aware dashboard that tracks every cylinder, order, and rupiah in real time.

The system handles:

- Multi-branch operations with a live branch switcher
- Full cylinder lifecycle tracking (registration → dispatch → return → weigh-in → write-off)
- Customer & supplier purchase order management
- Delivery order creation and reconciliation
- A loyalty/cashback system called **GasBack**
- Operational reports (stock, delivery recap, achievement tracking, DO vs PO comparisons)

---

## 🏗️ Tech Stack

| Layer          | Technology                                          |
| -------------- | --------------------------------------------------- |
| Framework      | [Next.js 15](https://nextjs.org/) (App Router)      |
| Language       | TypeScript                                          |
| Styling        | Tailwind CSS                                        |
| Database       | PostgreSQL via [Prisma ORM](https://www.prisma.io/) |
| Authentication | [NextAuth.js](https://next-auth.js.org/)            |
| State          | React context + Zustand (sidebar store)             |

---

## 📦 Features

### 🏭 Warehouse Management

- Inbound stock recording with auto-generated document numbers
- Empty cylinder returns tracking
- Cylinder write-off logging
- Live stock overview by cylinder type

### 🔵 Cylinder Lifecycle

- Register new cylinders with serial tracking
- Dispatch cylinders to customers or delivery routes
- Weigh-in on return (track gas weight delta)
- Full per-cylinder history log

### 📋 Purchase Orders

- **Customer PO** — manage orders from customers
- **Supplier PO** — manage procurement from suppliers (with HMT quota tracking per supplier)

### 🚚 Delivery Orders

- Create and manage delivery orders
- Edit and reconcile completed deliveries
- Link to customer POs for traceability

### 💰 GasBack (Loyalty Program)

- Configurable cashback settings
- Claims submission and approval flow
- Per-customer ledger view
- Summary reporting

### 📊 Reports

| Report           | Description                                  |
| ---------------- | -------------------------------------------- |
| **Stock Tabung** | Current cylinder inventory by type           |
| **Rekap Kirim**  | Delivery recap by period                     |
| **Pencapaian**   | Sales achievement vs. targets                |
| **DO vs PO**     | Delivery order vs. purchase order comparison |

### 👥 People Management

- **Customers** — CRUD with cylinder holdings view
- **Suppliers** — CRUD with HMT quota management
- **Employees** — CRUD with role assignments
- **Users** — System user management with role-based access

### 🔀 Multi-Branch Support

- Branch switcher in the top bar
- All data scoped to the active branch
- Sessions are branch-aware

---

## 🗂️ Project Structure

```raw
ssgv2/
├── app/
│   ├── (auth)/              # Login page & auth layout
│   ├── (dashboard)/         # All dashboard pages
│   │   ├── customers/       # Customer management
│   │   ├── suppliers/       # Supplier management
│   │   ├── cylinders/       # Cylinder tracking (dispatch, weigh, register)
│   │   ├── warehouse/       # Inbound, returns, write-offs
│   │   ├── customer-po/     # Customer purchase orders
│   │   ├── supplier-po/     # Supplier purchase orders
│   │   ├── delivery/        # Delivery orders
│   │   ├── recon/           # Reconciliation
│   │   ├── gasback/         # Loyalty claims & ledger
│   │   ├── reports/         # All report pages
│   │   ├── employees/       # Employee management
│   │   ├── users/           # User management
│   │   └── settings/        # System settings
│   └── api/                 # REST API routes (mirroring dashboard structure)
├── components/              # Shared UI components
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── BranchSwitcher.tsx
│   ├── Breadcrumb.tsx
│   ├── FormPageLayout.tsx
│   └── ...
├── lib/                     # Shared utilities & contexts
│   ├── auth.ts
│   ├── prisma.ts
│   ├── branch-context.tsx
│   ├── document-numbers.ts
│   └── gasback-settings.ts
└── prisma/                  # Database schema & seed scripts
    └── schema.prisma
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- `.env` file with the following variables:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/ssgv2"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/ssgv2.git
cd ssgv2

# Install dependencies
npm install

# Set up the database
npx prisma migrate dev

# Seed initial data (cylinder types, gasback settings, branches)
npx ts-node prisma/seed.ts
npx ts-node prisma/seed-cylinder-types.ts
npx ts-node prisma/seed-gasback-settings.ts

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Authentication

The app uses **NextAuth.js** with credential-based login. Users are assigned roles that control what pages and actions they can access. Sessions are server-validated and scoped per branch.

---

## 🌿 Key Conventions

- **API routes** mirror the page structure — each dashboard section has a corresponding `/api/` route
- **Document numbers** are auto-generated via `lib/document-numbers.ts` (e.g. inbound receipts)
- **Branch context** is provided globally via `lib/branch-context.tsx` — all queries are branch-scoped
- **Prisma client** is a singleton via `lib/prisma.ts` to avoid connection pool exhaustion in dev

---

## 🤝 Contributors

### Human

**LAFF** — Project owner, domain expert, and lead developer.
Designed the business logic, defined all operational requirements, and drove the product vision from end to end.

---

### AI

**Claude Sonnet 4.6** by [Anthropic](https://www.anthropic.com) — Largest code contributor.

Claude served as the primary development partner throughout this project — functioning not just as a code generator, but as a full-cycle engineering collaborator:

- 🏗️ **Architecture decisions** — App Router structure, API design, Prisma schema modeling
- 🧩 **Feature implementation** — Built the majority of pages, API routes, and components
- 🐛 **Debugging & troubleshooting** — Diagnosed and resolved issues across the full stack
- 📐 **Code conventions** — Established and enforced consistent patterns across 117 directories and 144 files
- 🧠 **Domain modeling** — Helped translate LPG distribution business logic into working software

> _"This project would not exist in its current form without Claude. It was a genuine collaboration — not autocomplete, but a real engineering partnership."_
> — LAFF

---

## 📄 License

Private / Internal Use. All rights reserved.

---

<p align="center">
  Built with ❤️ in Surabaya &nbsp;·&nbsp; Powered by <a href="https://www.anthropic.com">Claude AI (Sonnet 4.6)</a>
</p>

# 🚀 Feature Backlog (30 Items)

**Filter Applied:** Easy Only · High Impact · Strategic Additions Included

---

## 🟢 Easy · High Impact (Priority Execution Layer)

| Feature                     | Description                                                                       | Effort | Impact | Category   | Source |
| --------------------------- | --------------------------------------------------------------------------------- | ------ | ------ | ---------- | ------ |
| Print layout for DO & PO ★  | CSS `@media print` styles on delivery order and PO detail pages. No backend work. | Easy   | High   | Operations | Yours  |
| Export reports to Excel/PDF | Add download buttons to all report pages using SheetJS.                           | Easy   | High   | Reports    | System |
| Role-based access control   | Middleware guards on pages and API routes by role.                                | Easy   | High   | Security   | System |
| Dashboard charts & KPIs     | Use `/api/dashboard` with Recharts (delivery, stock, gasback).                    | Easy   | High   | Analytics  | System |
| Scanner integration (USB) ★ | Autofocus serial inputs; USB scanners behave as keyboard input.                   | Easy   | High   | Operations | Yours  |
| Overdue cylinder alerts     | Flag cylinders not returned past threshold; show dashboard alerts.                | Easy   | High   | Operations | System |

---

## 🟡 Easy · Medium Impact (Quick Wins)

| Feature                 | Description                                          | Effort | Impact | Category    | Source |
| ----------------------- | ---------------------------------------------------- | ------ | ------ | ----------- | ------ |
| Inline field validation | Zod validation before submit; reduce API roundtrips. | Easy   | Medium | UX          | System |
| Confirmation dialogs    | Require modal confirmation for destructive actions.  | Easy   | Medium | UX          | System |
| Pagination on lists     | Server-side pagination for all major tables.         | Easy   | Medium | Performance | System |
| Date range filter       | Custom date filtering across reports.                | Easy   | Medium | Reports     | System |

---

## 🔵 Easy · Low Impact (Polish Layer)

| Feature              | Description                                 | Effort | Impact | Category | Source |
| -------------------- | ------------------------------------------- | ------ | ------ | -------- | ------ |
| Sticky table headers | Freeze headers on scroll.                   | Easy   | Low    | UX       | System |
| Empty states         | Use `EmptyState.tsx` with CTA on all pages. | Easy   | Low    | UX       | System |

---

## 🟠 Medium · High Impact (Scale Layer)

| Feature                 | Description                                       | Effort | Impact | Category   | Source |
| ----------------------- | ------------------------------------------------- | ------ | ------ | ---------- | ------ |
| Global search (Cmd+K) ★ | Unified search across entities via `/api/search`. | Medium | High   | UX         | Yours  |
| Bulk customer import ★  | Excel upload with validation preview.             | Medium | High   | Operations | Yours  |
| Audit log               | Track all create/update/delete actions.           | Medium | High   | Security   | System |
| Scanner (camera) ★      | ZXing browser-based scanning for mobile.          | Medium | High   | Operations | Yours  |
| Mobile driver flow      | Simplified UI for drivers (dispatch/delivery).    | Medium | High   | Operations | System |
| Low stock notifications | Threshold-based alerts per cylinder type.         | Medium | High   | Operations | System |

---

## 🟣 Medium · Medium Impact

| Feature                 | Description                                           | Effort | Impact | Category   | Source |
| ----------------------- | ----------------------------------------------------- | ------ | ------ | ---------- | ------ |
| Bulk cylinder import    | Excel-based mass registration.                        | Medium | Medium | Operations | System |
| Delivery timeline       | Visual lifecycle tracking per delivery.               | Medium | Medium | UX         | System |
| Cylinder heatmap        | Distribution view (warehouse vs customer vs transit). | Medium | Medium | Analytics  | System |
| PO vs actual trends     | Extend variance reporting over time.                  | Medium | Medium | Reports    | System |
| Gasback balance display | Highlight balance on customer page.                   | Medium | Medium | UX         | System |

---

## ⚪ Medium · Low Impact

| Feature            | Description                        | Effort | Impact | Category | Source |
| ------------------ | ---------------------------------- | ------ | ------ | -------- | ------ |
| Keyboard shortcuts | Power-user navigation (N, /, Esc). | Medium | Low    | UX       | System |

---

## 🔴 Hard · High Impact (Strategic Differentiators)

| Feature                | Description                                    | Effort | Impact | Category   | Source |
| ---------------------- | ---------------------------------------------- | ------ | ------ | ---------- | ------ |
| Google OAuth ★         | NextAuth Google login with domain restriction. | Hard   | High   | Security   | Yours  |
| WhatsApp notifications | Delivery alerts via WhatsApp API.              | Hard   | High   | Operations | System |
| Customer portal        | Token-auth public access to orders & balances. | Hard   | High   | Operations | System |
| Multi-branch transfer  | Stock transfer workflow with approval.         | Hard   | High   | Operations | System |

---

## ⚫ Hard · Medium Impact

| Feature                  | Description                                        | Effort | Impact | Category   | Source |
| ------------------------ | -------------------------------------------------- | ------ | ------ | ---------- | ------ |
| Automated recon matching | Auto-match PO vs DO lines with exception handling. | Hard   | Medium | Operations | System |
| Route optimisation       | Delivery routing via Google Maps API.              | Hard   | Medium | Operations | System |

---

# 🧠 Strategic Insight

If you want maximum ROI with minimum engineering drag:

**Execute in this order:**

1. Easy + High → Immediate operational leverage
2. Medium + High → System scalability
3. Hard + High → Competitive moat

You already have a strong system foundation — this backlog is about **turning it into an enterprise-grade operational platform**.

If you want, I can convert this into:

- Jira tickets
- Sprint roadmap (2–4 weeks)
- System architecture mapping

Just say the word.
