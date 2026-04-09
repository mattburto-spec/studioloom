# Project: Monetisation & Tier Management
**Created: 3 April 2026**
**Status: IDEA — architectural thinking, not yet specced**
**Depends on: Core platform stable, admin dashboard (Dimensions3 Phase E)**

---

## What This Is

Revenue infrastructure for StudioLoom: Stripe integration, tiered access, usage limits, billing management, and the admin dashboard page to manage it all.

## Tier Structure (Draft)

### Free Tier
- 1 class
- 30 students
- 30 units (create or import)
- Basic AI features (Design Assistant, toolkit tools)
- No AI unit generation (manual creation + lesson editor only)
- Community toolkit tools (public `/toolkit`)
- StudioLoom branding on student-facing pages
- 30-day data retention after account inactive

### Starter ($10/month or $96/year)
- 5 classes
- 150 students
- 150 units
- AI unit generation (Express + Guided lanes)
- Knowledge base (limited: 50 uploads, 500MB storage)
- Safety badges
- Class Gallery
- Open Studio
- Email support

### Professional ($50/month or $480/year)
- Unlimited classes
- Unlimited students
- Unlimited units
- Full AI generation (all 3 lanes + Architect)
- Full knowledge base (unlimited uploads, 5GB storage)
- All features including:
  - New Metrics / Melbourne Metrics
  - Teaching Mode with projector
  - Discovery Engine
  - Real Client (when available)
  - AI critics
  - Advanced analytics
  - Priority AI queue (faster generation)
- Custom branding removal
- Priority support
- API access (future)

### School/Enterprise (Custom pricing)
- Multi-teacher management
- School-wide admin dashboard
- SSO integration (Azure AD, Google Workspace)
- Custom framework configuration
- Dedicated support
- Data residency options
- SLA guarantees

## Architecture Requirements

### What Needs to Exist in the Codebase

#### 1. Tier Definition System
```
teacher_profiles.tier: 'free' | 'starter' | 'professional' | 'enterprise'
teacher_profiles.tier_expires_at: TIMESTAMPTZ (null = no expiry / lifetime)
teacher_profiles.stripe_customer_id: TEXT
teacher_profiles.stripe_subscription_id: TEXT
```

#### 2. Feature Gating Middleware
A `checkTierAccess(teacherId, feature)` function that:
- Reads teacher's tier from profile (cached, not per-request DB hit)
- Checks feature against tier permissions map
- Returns `{ allowed: boolean, reason?: string, upgradeUrl?: string }`
- Used in API routes as guard: `if (!access.allowed) return 403 with upgrade prompt`

Feature permission map (TypeScript constant):
```typescript
const TIER_FEATURES: Record<Tier, Feature[]> = {
  free: ['manual_unit_creation', 'lesson_editor', 'design_assistant', 'toolkit_public', 'basic_grading'],
  starter: [...free, 'ai_generation_express', 'ai_generation_guided', 'knowledge_base', 'safety_badges', 'gallery', 'open_studio'],
  professional: [...starter, 'ai_generation_architect', 'new_metrics', 'teaching_mode', 'discovery_engine', 'real_client', 'ai_critics', 'advanced_analytics'],
  enterprise: [...professional, 'multi_teacher', 'sso', 'custom_frameworks', 'api_access'],
};
```

#### 3. Usage Limits Enforcement
Counters that track and enforce limits:
- `class_count` — checked on class creation
- `student_count` — checked on student enrollment
- `unit_count` — checked on unit creation/import
- `upload_count` / `storage_bytes` — checked on knowledge base upload
- `ai_generation_count` — monthly, checked on generation start

Stored as: `teacher_usage` table with rolling monthly counters, or computed from existing tables on demand (slower but no new table).

#### 4. Stripe Integration
- Checkout session creation (redirect to Stripe-hosted page)
- Webhook handler for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Customer portal link (Stripe-hosted billing management)
- Proration handling for mid-cycle upgrades
- Grace period on payment failure (7 days before downgrade)

#### 5. Admin Dashboard Page
New admin tab: **Billing & Tiers**
- View all teachers with tier, status, expiry
- Manual tier override (for beta testers, partners)
- Revenue dashboard (MRR, churn, upgrades, downgrades)
- Usage analytics per tier (which features used most, where free users hit limits)
- Stripe webhook log

#### 6. Teacher-Facing Upgrade Flow
- Upgrade prompts at limit boundaries ("You've used 28 of 30 units. Upgrade for unlimited.")
- Settings page billing section (current tier, usage, upgrade/downgrade buttons)
- Stripe customer portal link for payment method changes
- Downgrade confirmation with data impact warning

## Do We Need to Do Anything Now?

**For Dimensions3 build: YES, small things.**

1. **Add `tier` column to teacher_profiles** — even if we don't enforce it yet, having the column means all new code can check it. Default: `'free'`. Migration is trivial.

2. **Design the feature gating function signature** — so Dimensions3 generation routes can include `checkTierAccess(teacherId, 'ai_generation')` calls even before Stripe is wired. Return `{ allowed: true }` for everyone during beta.

3. **AI cost tracking already exists** — `ai_usage_log` table tracks per-teacher costs. This is the foundation for usage-based limits or per-teacher cost visibility in admin.

4. **Generation pipeline cost tracking** — Dimensions3 already plans per-stage cost tracking in the sandbox. Extend to per-teacher aggregation.

**What can wait:**
- Stripe integration (no revenue to collect yet)
- Actual limit enforcement (no users to limit yet)
- Admin billing dashboard (no billing to manage yet)
- Enterprise features (way down the track)

## Build Estimate
- Tier column + gating function stub: ~0.5 days (do during Dimensions3)
- Stripe integration + webhook handler: ~2-3 days
- Upgrade flow UI + billing settings: ~2 days
- Admin billing dashboard: ~1-2 days
- Limit enforcement across all routes: ~1-2 days
- Total: ~7-10 days, but can be spread across milestones

## Open Questions
1. Annual pricing discount — 20% (shown above) or more aggressive?
2. Free tier AI generation — none at all, or 3 free units to hook teachers?
3. Student-facing pricing — should students ever pay? (Makloom yes, StudioLoom no — school buys)
4. Per-student pricing vs per-teacher flat rate? (Most EdTech does per-student for enterprise)
5. Freemium conversion funnel — what's the killer feature that makes free users upgrade?
6. China pricing — different tier structure for China market? (WeChat Pay, Alipay instead of Stripe)
7. Data export on downgrade — what happens to content above the free tier limit?
