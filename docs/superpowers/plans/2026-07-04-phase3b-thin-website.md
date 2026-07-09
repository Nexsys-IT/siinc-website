# Phase 3B: Website Goes Thin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The website stops owning Xero entirely (module, OAuth routes, admin page, Redis token store, keepalive cron), reads live plans from the front-end's `GET /api/plans/`, and posts signups with the canonical plan name — no `xero_id`, no `charge_rate` — with TLS verification fixed.

**Architecture:** A new server-only `src/lib/plans.ts` fetches plans from the front-end (scoped `PLANS_READ_KEY`, ISR-cached) with a static fallback so the site never hard-fails on the API. The pricing section and signup dropdown render from that data. `POST /api/signup` shrinks to validate → POST `/api/client/` (front-end creates the Xero contact per Phase 3A). All Xero code and its Redis dependency are deleted. This is Phase 3B of `SIINC-Central-Pricing-Xero-Provisioning-Design.md` (§7.2); front-end Phase 3A ships first and accepts both old and new website behavior.

**Tech Stack:** Next.js 16 App Router (Vercel serverless), TypeScript strict, axios, ESLint+Prettier (`no-console: error`), NEW: vitest for the pure helpers.

## Global Constraints

- Branching: this repo has ONLY `main`. First create `dev` off `main` and push it (`git checkout -b dev && git push -u origin dev`), then work on `feat/phase3b-thin-signup` off `dev`; PR targets `dev`. (SIINC workflow: PRs → dev.)
- Gates before any completion claim: `npm run lint` (zero errors — note `no-console` is `error`: use no console calls in new code), `npm run build` succeeds, `npx vitest run` passes.
- The signup POST to the front-end keeps env var `SIINC_API_KEY` and header `X-API-Key` (unchanged name; Phase 4 rotates the value to the website-scoped key).
- NEW env vars: `PLANS_READ_KEY` (scoped read key for GET /api/plans/) and `SIINC_APP_URL` (default `https://app.siinc.io` when unset — replaces the hardcoded URL).
- **Fix, do not preserve:** `rejectUnauthorized: false` (signup/route.ts:270) must be REMOVED — app.siinc.io serves a valid chain since the P1-3 TLS fix. No `https.Agent` override at all.
- Canonical plan names: the website's internal ids stay lowercase (`standard|professional|enterprise`) for URLs/forms; the PAYLOAD sent to the front-end uses the canonical name from the fetched plans (matched case-insensitively), falling back to capitalising the first letter if the plans API was unreachable.
- Graceful degradation is a hard requirement: if `GET /api/plans/` fails, the pricing page renders the static fallback plans (names + features, no rates) and signup still works — never a hard failure from the plans dependency.
- Secrets: never print or commit real key values; `.env.example` gets placeholder-only entries (file doesn't exist yet — create it).
- Do NOT `git add` docs/superpowers/; commit steps list exact files.

## File Structure

- Create: `src/lib/plans.ts` (server-only fetch + canonicalise + fallback), `src/lib/plans.test.ts`, `vitest.config.ts`, `.env.example`
- Modify: `src/components/sections/pricing.tsx` (accept plans prop, show rates), `src/app/page.tsx` + `src/app/pricing/page.tsx` (server-side fetch → prop), `src/app/signup/page.tsx` (dropdown from plans prop via a server wrapper), `src/app/api/signup/route.ts` (thin), `package.json` (vitest; remove redis), `vercel.json` (remove keepalive cron)
- Delete: `src/lib/xero.ts`, `src/app/api/xero/` (all 5 routes), `src/app/admin/xero/page.tsx`, `src/app/api/cron/keepalive/route.ts`
- Leave untouched: `src/components/sections/pricing2.tsx` (dead template file, never imported), contact/event-registration/test-email routes (Postmark).

---

### Task 1: Branch setup + vitest + `src/lib/plans.ts`

**Files:**
- Create: `vitest.config.ts`, `src/lib/plans.ts`, `src/lib/plans.test.ts`, `.env.example`
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)

**Interfaces (produces):**

```ts
// src/lib/plans.ts — SERVER ONLY (imports 'server-only'); never ship keys to the client
export interface SiincPlan {
  name: string;          // canonical, e.g. "Standard"
  id: string;            // lowercase slug, e.g. "standard"
  ratePerGb: string | null;   // "1.3500" or null (negotiated)
  minCharge: string | null;
  minUsageGb: number;
  isNegotiated: boolean;
}
export const FALLBACK_PLANS: SiincPlan[];   // Standard/Professional/Enterprise, null rates
export async function fetchPlans(): Promise<{ plans: SiincPlan[]; live: boolean }>;
export function canonicalPlanName(id: string, plans: SiincPlan[]): string;
```

- `fetchPlans()`: `GET ${SIINC_APP_URL ?? 'https://app.siinc.io'}/api/plans/` with `X-Api-Key: PLANS_READ_KEY`, `next: { revalidate: 300 }` via the built-in `fetch`; maps `{name, rate_per_gb, min_charge, min_usage_gb, is_negotiated}` → `SiincPlan` (id = `name.toLowerCase()`); ANY failure (missing key, non-200, bad shape) → `{ plans: FALLBACK_PLANS, live: false }` — no throw, no console.
- `canonicalPlanName("standard", plans)` → `"Standard"` (case-insensitive match on id or name); unknown id → first-letter-capitalised input.

- [ ] **Step 0: Branches**

```bash
cd c:/Users/MalcolmBrightman/Code/SIINC/siinc-website
git checkout main && git pull
git checkout -b dev && git push -u origin dev
git checkout -b feat/phase3b-thin-signup
```

- [ ] **Step 1:** `npm install --save-dev vitest` and add `"test": "vitest run"` to scripts. Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Failing tests** — `src/lib/plans.test.ts` (mock global `fetch` with `vi.stubGlobal`; set env via `vi.stubEnv`). Cases: happy-path mapping (payload from the real contract: `{"plans":[{"name":"Basic","rate_per_gb":"1.5000","min_charge":"60.00","min_usage_gb":0,"is_negotiated":false}, ...]}` → ids lowercased, `live: true`); fetch rejects → fallback + `live: false`; non-200 → fallback; missing `PLANS_READ_KEY` env → fallback without calling fetch; `canonicalPlanName('professional', plans)` → `'Professional'`; unknown id `'gold'` → `'Gold'`. Note: `import 'server-only'` must be mocked in vitest config or via `vi.mock('server-only', () => ({}))` at the top of the test file — do the latter.

Run: `npx vitest run` → FAIL (module doesn't exist).

- [ ] **Step 3: Implement `src/lib/plans.ts`** per the interface above (single file, ~80 lines; `import 'server-only';` first line; read env INSIDE `fetchPlans` so tests can stub; wrap everything in try/catch returning the fallback).

FALLBACK_PLANS content — the three public plans with no rates (mirrors today's site which shows no prices):

```ts
export const FALLBACK_PLANS: SiincPlan[] = [
  { name: 'Standard', id: 'standard', ratePerGb: null, minCharge: null, minUsageGb: 100, isNegotiated: false },
  { name: 'Professional', id: 'professional', ratePerGb: null, minCharge: null, minUsageGb: 500, isNegotiated: false },
  { name: 'Enterprise', id: 'enterprise', ratePerGb: null, minCharge: null, minUsageGb: 5000, isNegotiated: true },
];
```

- [ ] **Step 4:** `npx vitest run` → all pass; `npm run lint` clean. Create `.env.example`:

```
# Front-end API access
SIINC_API_KEY=
PLANS_READ_KEY=
# SIINC_APP_URL=https://app.siinc.io   # override for local testing
# Email
POSTMARK_SERVER_TOKEN=
# Vercel cron auth
CRON_SECRET=
```

- [ ] **Step 5: Commit** — `git add package.json package-lock.json vitest.config.ts src/lib/plans.ts src/lib/plans.test.ts .env.example` + `git commit -m "feat(plans): server-only live plans fetch with static fallback + vitest harness"`

---

### Task 2: Pricing + signup UI read live plans

**Files:**
- Modify: `src/components/sections/pricing.tsx`, `src/app/page.tsx`, `src/app/pricing/page.tsx`, `src/app/signup/page.tsx`

**Interfaces:**
- `Pricing` becomes `Pricing({ headerTag, plans }: { headerTag?: ...; plans: SiincPlan[] })` — still a Client Component; the hardcoded `plans` array's FEATURE LISTS stay as a local `PLAN_FEATURES: Record<string, string[]>` keyed by id (the API has no feature bullets), but names/ids/rates come from the prop. Rate display: when `ratePerGb` is non-null render `From $X.XX/GB/mo` (format with 2 decimals) under the plan name; negotiated/null → `Custom pricing`. Keep existing layout/classes otherwise (frontend-design restraint: this is an incremental change, match existing look).
- `src/app/page.tsx` and `src/app/pricing/page.tsx` (both Server Components) call `await fetchPlans()` and pass `plans` down. Signup page: it's `'use client'` — wrap it: create the plan OPTIONS server-side in `src/app/signup/page.tsx` by converting it to a thin server component that fetches plans and renders the existing client form component (move the current file's client component into `src/app/signup/signup-form.tsx` with a `plans: {id, name}[]` prop; dropdown options map over it; Zod enum widens to `z.string().min(1)` validated against the passed ids at submit time).

- [ ] **Step 1:** Implement (no new test files — the pure logic was tested in Task 1; UI verified by build + smoke). Preserve `?plan=` param behavior (validate against the fetched ids, default `standard`).
- [ ] **Step 2:** `npm run build` succeeds (proves server/client component split is valid); `npm run lint` clean; `npx vitest run` still green.
- [ ] **Step 3: Commit** — `git add src/components/sections/pricing.tsx src/app/page.tsx src/app/pricing/page.tsx src/app/signup/page.tsx src/app/signup/signup-form.tsx` + `git commit -m "feat(pricing): render live plan rates from front-end; signup options from live plans"`

---

### Task 3: Thin the signup route

**Files:**
- Modify: `src/app/api/signup/route.ts`

**Interfaces:**
- Remove imports from `@/lib/xero` and the `searchXeroContact`/`createXeroContact` functions + their call steps.
- New flow: validate/sanitize (unchanged) → `const { plans } = await fetchPlans()` → `const canonicalPlan = canonicalPlanName(plan || 'standard', plans)` → `createSIINCUser(...)` → emails (unchanged) → 200.
- `createSIINCUser` changes: URL becomes `` `${process.env.SIINC_APP_URL ?? 'https://app.siinc.io'}/api/client/` ``; payload drops `xero_id` and `charge_rate` entirely; `plan: canonicalPlan`; DELETE the `https.Agent({ rejectUnauthorized: false })` + `httpsAgent` option (default verification); keep `X-API-Key: SIINC_API_KEY`, timeout, validateStatus.
- Error mapping: remove the Xero-specific 503 branches (`Xero not connected`, scopes, refresh); keep `User already exists` → 409 and generic 500. `validateEnvironment()` still requires only `SIINC_API_KEY`.

- [ ] **Step 1:** Implement. **Step 2:** `npm run build` + `npm run lint` + `npx vitest run` all clean. Manual read-through: grep the file for `xero`, `charge_rate`, `rejectUnauthorized` → zero hits.
- [ ] **Step 3: Commit** — `git add src/app/api/signup/route.ts` + `git commit -m "feat(signup): thin route — canonical plan via live fetch, no Xero, no charge_rate, TLS verification restored"`

---

### Task 4: Xero + Redis removal sweep, gate, PR

**Files:**
- Delete: `src/lib/xero.ts`, `src/app/api/xero/authorize/route.ts`, `.../callback/route.ts`, `.../refresh/route.ts`, `.../disconnect/route.ts`, `.../status/route.ts`, `src/app/admin/xero/page.tsx`, `src/app/api/cron/keepalive/route.ts`
- Modify: `package.json` (remove `redis` dependency), `vercel.json` (remove the keepalive cron entry; keep headers/redirects)

- [ ] **Step 1:** Delete the files; `npm uninstall redis`; edit `vercel.json`.
- [ ] **Step 2:** Repo-wide grep gate: `xero`, `XERO_`, `redis`, `REDIS_URL`, `ADMIN_SECRET`, `rejectUnauthorized`, `charge_rate` → zero hits in `src/` (README/docs mentions OK). `npm run build` + `npm run lint` + `npx vitest run` → clean.
- [ ] **Step 3: Commit, push, PR**

```bash
git add -A src/ package.json package-lock.json vercel.json
git commit -m "feat(website)!: remove Xero integration, Redis token store, and keepalive cron"
git push -u origin feat/phase3b-thin-signup
gh pr create --base dev --title "Phase 3B: website goes thin — live plans, canonical signup, Xero removed" --body "Phase 3B of the Central Pricing + Xero initiative (design §7.2). Requires front-end Phase 3A deployed first (it accepts both old and new payloads, so ordering is safe).

- Pricing + signup read live plans from GET /api/plans/ (PLANS_READ_KEY, ISR 300s) with a static no-rates fallback — the site never hard-fails on the plans API.
- Signup posts the CANONICAL plan name and no longer sends xero_id or charge_rate — the front-end now owns Xero contact creation (Phase 3A).
- SECURITY: removed rejectUnauthorized:false on the front-end call — TLS verification restored (valid chain since the P1-3 fix).
- Deleted: lib/xero.ts, all /api/xero/* OAuth routes, /admin/xero page, Redis token store + keepalive cron, redis dependency, XERO_*/ADMIN_SECRET env usage.
- New env on Vercel: PLANS_READ_KEY (+ optional SIINC_APP_URL). Removable env after deploy: XERO_CLIENT_ID/SECRET/REDIRECT_URI, ADMIN_SECRET, REDIS_URL, NEXT_PUBLIC_BASE_URL, CRON_SECRET.
- Added vitest (first tests in this repo) for the plans helpers.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Out of scope
- Rotating SIINC_API_KEY's value to the website-scoped identity (Phase 4 cutover).
- mTLS client certificate (Phase 4).
- Removing `pricing2.tsx` dead template (unrelated cleanup).
