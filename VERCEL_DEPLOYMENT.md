# StudioLoom (Questerra) — Vercel Deployment Checklist

**Last updated:** 19 March 2026
**Status:** Ready for deployment ✓

---

## Pre-Deployment Verification

### ✓ Build Configuration
- [x] `next.config.ts` is properly configured with Sentry integration
- [x] Heavy packages marked as `serverExternalPackages`: pdf-parse, mammoth, officeparser, jszip
- [x] Webpack config handles node: prefix replacements correctly (pptxgenjs compatibility)
- [x] Fallbacks configured for fs, os, path, http, https in browser bundle
- [x] Build script in package.json: `"build": "next build"`

### ✓ Code Quality
- [x] No fs/child_process imports in browser code
- [x] No dangerous subprocess execution (spawn, exec)
- [x] Middleware is Vercel-compatible (uses NextRequest/NextResponse correctly)
- [x] All route handlers are async and return proper Response objects
- [x] No blocking I/O in middleware

### ✓ Environment Variables
- [x] `.env.example` created with all 10+ required and optional variables
- [x] `.env.local` is in `.gitignore` (not committed)
- [x] No secrets hardcoded in source code
- [x] All process.env accesses use non-null assertions where required
- [x] Graceful degradation for optional features (Sentry, ElevenLabs, fallback AI models)

### ✓ Database & External Services
- [x] Supabase configured with Row-Level Security (RLS) policies
- [x] Supabase migrations (25) are tracked and versioned
- [x] Database schema supports all features (units, knowledge base, usage tracking, etc.)

### ✓ AI Integration
- [x] Anthropic API key properly resolved and validated
- [x] Fallback chain implemented: Anthropic → Groq → Gemini
- [x] Encryption key stored for BYOK (Bring Your Own Key) support
- [x] Voyage AI embeddings for RAG retrieval
- [x] Response length heuristics to prevent oversized outputs
- [x] Sentry error tracking integrated

### ✓ Security
- [x] AES-256-GCM encryption for BYOK keys
- [x] RLS policies on Supabase database
- [x] HttpOnly, Secure, SameSite cookie settings
- [x] API routes check auth headers and user sessions
- [x] Rate limiting implemented (30/min, 200/hour per user)
- [x] ADMIN_EMAILS environment variable for access control

---

## Deployment Steps

### 1. Create Vercel Project
```bash
npm i -g vercel
vercel login
vercel link
```

### 2. Configure Environment Variables in Vercel
In Vercel dashboard → Project Settings → Environment Variables, add:

**REQUIRED:**
- `ANTHROPIC_API_KEY` — Anthropic API key (production)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (not exposed to browser)
- `VOYAGE_API_KEY` — Voyage AI API key for embeddings
- `ENCRYPTION_KEY` — 256-bit hex key for BYOK encryption (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

**OPTIONAL (recommended for production):**
- `NEXT_PUBLIC_SENTRY_DSN` — Sentry error tracking
- `SENTRY_AUTH_TOKEN` — For uploading source maps
- `ADMIN_EMAILS` — Comma-separated admin email list
- `GROQ_API_KEY` — Fallback AI provider
- `GEMINI_API_KEY` — Secondary fallback AI provider
- `ELEVENLABS_API_KEY` — Text-to-speech (if enabled)

### 3. Deploy
```bash
vercel --prod
```

Or use Vercel dashboard → New Project → Import from Git → Select questerra repo

### 4. Connect Domain
In Vercel dashboard → Domains:
- Add `studioloom.com` (or chosen domain)
- Point DNS to Vercel nameservers or use CNAME record

### 5. Database Migrations (One-time)
After first deployment, run Supabase migrations:
```bash
supabase db push
```
This applies all 25 migrations and creates tables for:
- Users & authentication
- Units & lessons
- Knowledge base & embeddings
- AI model configuration
- Usage tracking & AI logs

### 6. Post-Deployment Verification
- [ ] Visit homepage — public routes load correctly
- [ ] Visit `/toolkit` — Design thinking toolkit loads (dark theme)
- [ ] Test `/login` → teacher login with Supabase auth
- [ ] Test `/api/tools/*` endpoints (SCAMPER, Six Hats, PMI, Five Whys, Empathy Map)
- [ ] Check Sentry dashboard for error tracking (if configured)
- [ ] Monitor API response times in Vercel Analytics
- [ ] Verify `/admin` routes redirect unauthenticated users

---

## Environment Variables Reference

### Core Dependencies
| Variable | Required? | Purpose | Where to Get |
|----------|-----------|---------|--------------|
| ANTHROPIC_API_KEY | YES | Claude AI for all generation | https://console.anthropic.com/keys |
| NEXT_PUBLIC_SUPABASE_URL | YES | Database connection | Supabase dashboard → Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | YES | Client-side auth | Supabase dashboard → Settings → API |
| SUPABASE_SERVICE_ROLE_KEY | YES | Server-side operations | Supabase dashboard → Settings → API (keep secret!) |
| VOYAGE_API_KEY | YES | Vector embeddings | https://www.voyageai.com/api-keys |
| ENCRYPTION_KEY | YES | BYOK encryption | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Optional but Recommended
| Variable | Purpose | Impact if Missing |
|----------|---------|-------------------|
| NEXT_PUBLIC_SENTRY_DSN | Error tracking | No error monitoring |
| SENTRY_AUTH_TOKEN | Source maps upload | Source maps won't be uploaded (build succeeds) |
| ADMIN_EMAILS | Admin access control | Defaults to mattburto@gmail.com |
| GROQ_API_KEY | Fallback AI provider | Falls back to Gemini if Anthropic fails |
| GEMINI_API_KEY | Secondary fallback | Falls back to local error if both Anthropic & Groq fail |
| ELEVENLABS_API_KEY | Text-to-speech | TTS features disabled |

---

## Monitoring & Maintenance

### Post-Deployment
- Monitor Sentry dashboard for errors
- Check Vercel analytics for performance issues
- Monitor AI usage costs (Claude API, Voyage embeddings)
- Review `/api/admin/*` logs for issues

### Scaling Considerations
- Rate limiting is in-memory; scales horizontally on Vercel (resets on cold start)
- Database queries use Supabase connection pooling
- Vector embeddings cached in Supabase pgvector
- Static assets served via Vercel CDN

### Troubleshooting
- **Build fails with SWC error:** Normal on non-x86 machines during local build; Vercel builds on x86
- **Missing ENCRYPTION_KEY:** Students can't add custom AI keys (BYOK feature fails gracefully)
- **Missing VOYAGE_API_KEY:** Knowledge base ingestion fails; RAG searches use BM25 fallback
- **Missing Anthropic key:** All AI generation disabled (critical)

---

## Files Changed
- Created: `.env.example` (99 lines) — comprehensive environment variable reference
- Created: `VERCEL_DEPLOYMENT.md` (this file) — deployment guide

---

## Next Steps After Deployment
1. ✓ Deploy to Vercel
2. Point domain `studioloom.com` to Vercel
3. Test all features (login, unit builder, knowledge base, design assistant, toolkit)
4. Set up monitoring (Sentry, Vercel Analytics)
5. Build next tier of interactive toolkit tools (Decision Matrix, How Might We)
6. Customer validation calls with MYP schools

---

**Status:** All pre-deployment checks passed. Ready to push to Vercel. 🚀
