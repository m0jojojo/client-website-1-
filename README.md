# The Block Bagru: Storefront

E-commerce storefront for handcrafted block-printed sarees and suits.
Stack: Next.js (App Router) + TypeScript + Tailwind, PostgreSQL + Prisma (from Phase 2), Razorpay, Resend, deployed on Vercel.

## Getting started

```bash
nvm use            # Node 24
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

## Scripts

| Script                 | Purpose                          |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Dev server                       |
| `npm run build`        | Production build                 |
| `npm run lint`         | ESLint                           |
| `npm run typecheck`    | TypeScript check                 |
| `npm run format:check` | Prettier check (`format` to fix) |
| `npm test`             | Unit/component tests (Vitest)    |
| `npm run test:e2e`     | End-to-end tests (Playwright)    |

## Workflow

Built in phases (see [docs/PLAN.md](docs/PLAN.md)). Each phase ends with a manual test
checkpoint, your approval, then a commit. Per-phase notes live in `docs/phases/`.
Commit and contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md).
