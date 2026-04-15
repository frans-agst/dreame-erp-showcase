# 02 — Dependencies

## package.json

```json
{
  "name": "omnierp-erp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest --run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@react-pdf/renderer": "^4.3.2",
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.90.1",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "next": "16.1.2",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-hook-form": "^7.71.1",
    "recharts": "^3.6.0",
    "xlsx": "^0.18.5",
    "zod": "^4.3.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5.1.2",
    "eslint": "^9",
    "eslint-config-next": "16.1.2",
    "fast-check": "^4.5.3",
    "jsdom": "^27.4.0",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.0.17"
  }
}
```

> No `requirements.txt` — this is a pure Node.js / TypeScript project with no Python dependencies.

---

## Dependency Breakdown

### Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.1.2 | Full-stack React framework (App Router) |
| `react` / `react-dom` | 19.2.3 | UI rendering |
| `@supabase/supabase-js` | ^2.90.1 | Supabase database & auth client |
| `@supabase/ssr` | ^0.8.0 | Supabase SSR helpers for Next.js middleware & server components |
| `zod` | ^4.3.5 | Schema validation for all form inputs and server action payloads |
| `react-hook-form` | ^7.71.1 | Form state management |
| `@hookform/resolvers` | ^5.2.2 | Zod integration with react-hook-form |
| `recharts` | ^3.6.0 | Dashboard charts (GMV trends, category breakdown) |
| `@react-pdf/renderer` | ^4.3.2 | PDF generation for PO exports and reports |
| `jspdf` + `jspdf-autotable` | ^4.2.1 / ^5.0.7 | Alternative PDF generation with table support |
| `xlsx` | ^0.18.5 | Excel export for sales reports and PO imports |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | Static typing |
| `tailwindcss` | ^4 | Utility-first CSS framework |
| `@tailwindcss/postcss` | ^4 | PostCSS integration for Tailwind v4 |
| `vitest` | ^4.0.17 | Unit test runner |
| `@vitejs/plugin-react` | ^5.1.2 | React support for Vitest |
| `jsdom` | ^27.4.0 | DOM environment for tests |
| `fast-check` | ^4.5.3 | Property-based testing |
| `eslint` + `eslint-config-next` | ^9 / 16.1.2 | Linting |

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT + RLS) |
| Styling | Tailwind CSS v4 |
| Validation | Zod v4 |
| Forms | React Hook Form |
| Charts | Recharts |
| PDF Export | @react-pdf/renderer + jsPDF |
| Excel Export/Import | xlsx |
| Testing | Vitest + fast-check |
| Deployment | Vercel |
