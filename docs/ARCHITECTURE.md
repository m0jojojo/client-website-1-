# Architecture

Living document, updated each phase.

- Framework: Next.js App Router, TypeScript, Tailwind CSS
- Data (Phase 2+): PostgreSQL (Vercel Marketplace / Neon) via Prisma
- Payments (Phase 8): Razorpay. Email: Resend
- Hosting: Vercel
- Tests: Vitest + Testing Library (unit/component), Playwright (e2e)

Layout: `src/app` routes, `tests/unit`, `tests/e2e`, `docs/`.
