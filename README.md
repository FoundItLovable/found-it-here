# FoundIt

FoundIt is a centralized lost and found management platform built for campuses, office complexes, and facilities. It connects staff who log found items with the people searching for them, replacing paper logs and spreadsheets with a structured, searchable system backed by AI-assisted item intake.

---

## Overview

When an item is found, staff log it through the admin portal with a photo, description, category, color, brand, and location. Google Gemini analyzes the uploaded photo and pre-fills item metadata automatically, reducing manual entry. A QR-code-based mobile capture flow lets staff photograph items with their phone and have the image sync directly to the desktop session in real time.

On the public side, users browse the visible catalog of found items or submit a lost item report. The platform cross-references reports against the inventory of found items and surfaces ranked potential matches with a confidence score.

Administrators manage their office's full inventory, process claims, control which items appear in the public catalog, and view operational metrics through an analytics dashboard.

---

## Features

- **AI-Assisted Item Logging** - Google Gemini analyzes item photos and returns structured metadata (name, description, category, color, brand) via a dedicated Express API.
- **Mobile Photo Capture** - Staff generate a time-limited QR code session from the desktop; scanning it on a mobile device opens a camera interface that uploads the photo directly to Supabase Storage and notifies the desktop.
- **Smart Matching** - Lost item reports are automatically compared against the found item inventory to surface ranked potential matches.
- **Public Catalog** - Found items can be toggled visible or hidden in the public-facing catalog on a per-item basis.
- **Admin Dashboard** - Full inventory management with search, category and status filtering, claims review, and item editing.
- **Metrics Panel** - Operational analytics including item volume, return rates, and category breakdowns.
- **Role-Based Access** - Supabase Auth separates staff (admin portal) from general users (public catalog and lost reports).
- **Multi-Office Support** - Staff accounts are scoped to an office, and found items are attributed to the office that logged them.

---

## Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI rendering |
| TypeScript | Type safety across the codebase |
| Vite | Development server and bundler |
| Tailwind CSS | Utility-first styling |
| shadcn/ui (Radix UI) | Accessible, composable UI primitives |
| Lucide React | Icon library |
| Recharts | Analytics charts |

### Backend
| Technology | Purpose |
|---|---|
| Express.js (Node.js) | API server for Gemini proxying and upload session management |
| TypeScript (tsx) | Type-safe server code with hot reload |
| Supabase | PostgreSQL database, Row Level Security, Auth, and Storage |
| Google Gemini API | Multimodal image analysis for automatic item metadata extraction |

### Tooling
| Technology | Purpose |
|---|---|
| Vitest | Unit testing |
| Testing Library | Component testing utilities |
| ESLint | Linting |
| Concurrently | Parallel dev server and API server startup |

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A Supabase project
- A Google Gemini API key

### Installation

```sh
# Clone the repository
git clone https://github.com/FoundItLovable/found-it-here.git
cd found-it-here

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
PUBLIC_APP_URL=http://localhost:8080
```

### Development

Run the frontend and API server concurrently:

```sh
npm run dev:all
```

Or run them separately:

```sh
# Frontend (Vite) — http://localhost:8080
npm run dev

# API server (Express) — http://localhost:5050
npm run server
```

### Testing

```sh
npm test
```

### Production Build

```sh
npm run build
```

---

## Project Structure

```
found-it-here/
├── server/
│   ├── index.ts          # Express API server (upload sessions, Gemini proxy)
│   └── gemini.ts         # Google Gemini image analysis logic
└── src/app/
    ├── pages/
    │   ├── LandingPage.tsx
    │   ├── AdminDashboard.tsx
    │   ├── AdminMobileCapture.tsx
    │   ├── UserDashboard.tsx
    │   ├── Login.tsx
    │   └── Signup.tsx
    ├── components/
    │   ├── admin/         # Admin-specific components (item cards, modals, metrics)
    │   └── ui/            # shadcn/ui component library
    ├── lib/               # Supabase client, auth helpers, database queries
    └── types/             # Shared TypeScript types and constants
```
