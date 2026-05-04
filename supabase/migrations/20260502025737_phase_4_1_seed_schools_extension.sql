-- Phase 4.1 — schools seed extension
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-4-brief.md §4 Phase 4.1
-- Date: 2 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- The Phase 0 seed (085_schools_seed.sql) shipped ~85 schools — IB MYP/DP/PYP
-- only, sourced from the IBO directory. Phase 4 introduces multi-framework
-- support (GCSE / A-Level / IGCSE / ACARA / PLTW) so the welcome-wizard
-- typeahead must also surface non-IB schools that match Matt's pilot
-- prospect criteria.
--
-- Curation criteria (per brief §3.8 Q11): each entry passes 2 of 3 filters:
--   (a) publicly lists a D&T / Innovation faculty / makerspace / design-thinking
--       programme on its website
--   (b) Matt has a connection or viable on-the-ground intro path
--       (Mandarin colleagues, AustCham network, IB Asia conference attendees,
--       Sydney mum-network)
--   (c) teaches a framework Matt can demo (MYP / GCSE / IGCSE / PYP /
--       A-Level / ACARA / PLTW)
--
-- This is NOT a directory dump. The seed exists so first-keystroke typeahead
-- finds Matt's pilot prospects, not so the directory is "complete." Future
-- expansion to 5-10k via FU-AV2-PHASE-4-SCHOOL-DIRECTORY-EXPANSION (P3).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - Adds ~100 schools across 6 markets (UK indies, Australia AHIGS,
--   US NAIS, Asia non-China fills, Europe non-UK fills, MEA fills,
--   plus NZ + Canada small fills).
-- - source='imported' — chosen over 'ibo' to flag these as "added by Phase
--   4 curation criteria" rather than "from IBO directory." (Adding a new
--   'curated' enum value would require altering the CHECK constraint on
--   schools.source, turning this data-only migration into a schema
--   migration. Reusing 'imported' is the safer call per brief §4.1 note.)
-- - verified=true — hand-curated, vouched-for entries.
-- - ib_programmes={} for non-IB schools (most UK indies, all Australia
--   non-IB indies, US PLTW schools).
-- - ON CONFLICT (normalized_name, country) DO NOTHING — idempotent.
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DELETEs all rows where source='imported' AND created_at
-- > '2026-05-02 00:00:00 UTC'. Won't touch any user_submitted / ibo entries.

INSERT INTO schools (name, city, country, ib_programmes, source, verified, created_by)
VALUES
  -- ──────────────────────────────────────────────────────────────────────
  -- UK independents (GCSE / A-Level + DT focus). HMC / ISI members with
  -- documented Design Technology faculty or innovation programmes.
  -- ──────────────────────────────────────────────────────────────────────
  ('Westminster School', 'London', 'GB', '{}', 'imported', true, NULL),
  ('Eton College', 'Windsor', 'GB', '{}', 'imported', true, NULL),
  ('Harrow School', 'London', 'GB', '{}', 'imported', true, NULL),
  ('St Paul''s School', 'London', 'GB', '{}', 'imported', true, NULL),
  ('Dulwich College', 'London', 'GB', '{}', 'imported', true, NULL),
  ('Charterhouse', 'Godalming', 'GB', '{}', 'imported', true, NULL),
  ('Marlborough College', 'Marlborough', 'GB', '{}', 'imported', true, NULL),
  ('Wellington College', 'Crowthorne', 'GB', '{}', 'imported', true, NULL),
  ('Tonbridge School', 'Tonbridge', 'GB', '{}', 'imported', true, NULL),
  ('Highgate School', 'London', 'GB', '{}', 'imported', true, NULL),
  ('Brighton College', 'Brighton', 'GB', '{}', 'imported', true, NULL),
  ('Wycombe Abbey', 'High Wycombe', 'GB', '{}', 'imported', true, NULL),
  ('St Paul''s Girls'' School', 'London', 'GB', '{}', 'imported', true, NULL),
  ('North London Collegiate School', 'London', 'GB', '{}', 'imported', true, NULL),
  ('Latymer Upper School', 'London', 'GB', '{}', 'imported', true, NULL),
  ('King''s College School Wimbledon', 'London', 'GB', '{}', 'imported', true, NULL),
  ('Manchester Grammar School', 'Manchester', 'GB', '{}', 'imported', true, NULL),
  ('Royal Grammar School Newcastle', 'Newcastle upon Tyne', 'GB', '{}', 'imported', true, NULL),
  ('Bedales School', 'Petersfield', 'GB', '{}', 'imported', true, NULL),
  ('Oundle School', 'Peterborough', 'GB', '{}', 'imported', true, NULL),

  -- ──────────────────────────────────────────────────────────────────────
  -- Australia — AHIGS / GPS / Independent Schools Australia. ACARA framework.
  -- Sydney density via Matt's mum's network; Melbourne via AustCham education
  -- chapter. Some IB MYP overlap (Wesley Melbourne already in 085 seed).
  -- ──────────────────────────────────────────────────────────────────────
  ('Sydney Grammar School', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('The Scots College', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Knox Grammar School', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Newington College', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Trinity Grammar School Sydney', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Cranbrook School', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Sydney Church of England Grammar School', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('SCEGGS Darlinghurst', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Pymble Ladies'' College', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Ravenswood School for Girls', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Ascham School', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Loreto Kirribilli', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('MLC School', 'Sydney', 'AU', '{}', 'imported', true, NULL),
  ('Methodist Ladies'' College Melbourne', 'Melbourne', 'AU', '{}', 'imported', true, NULL),
  ('Scotch College Melbourne', 'Melbourne', 'AU', '{}', 'imported', true, NULL),
  ('Melbourne Grammar School', 'Melbourne', 'AU', '{}', 'imported', true, NULL),
  ('Geelong Grammar School', 'Geelong', 'AU', '{}', 'imported', true, NULL),
  ('Trinity Grammar School Kew', 'Melbourne', 'AU', '{}', 'imported', true, NULL),
  ('Brisbane Grammar School', 'Brisbane', 'AU', '{}', 'imported', true, NULL),
  ('Anglican Church Grammar School', 'Brisbane', 'AU', '{}', 'imported', true, NULL),

  -- ──────────────────────────────────────────────────────────────────────
  -- US NAIS independents with documented innovation labs / PLTW / maker
  -- programmes. Many run AP not IB; a few run both.
  -- ──────────────────────────────────────────────────────────────────────
  ('Phillips Exeter Academy', 'Exeter', 'US', '{}', 'imported', true, NULL),
  ('Phillips Academy Andover', 'Andover', 'US', '{}', 'imported', true, NULL),
  ('Sidwell Friends School', 'Washington', 'US', '{}', 'imported', true, NULL),
  ('Lakeside School', 'Seattle', 'US', '{}', 'imported', true, NULL),
  ('Punahou School', 'Honolulu', 'US', '{}', 'imported', true, NULL),
  ('Dalton School', 'New York', 'US', '{}', 'imported', true, NULL),
  ('Castilleja School', 'Palo Alto', 'US', '{}', 'imported', true, NULL),
  ('Choate Rosemary Hall', 'Wallingford', 'US', '{}', 'imported', true, NULL),
  ('Hotchkiss School', 'Lakeville', 'US', '{}', 'imported', true, NULL),
  ('Deerfield Academy', 'Deerfield', 'US', '{}', 'imported', true, NULL),
  ('Lawrenceville School', 'Lawrenceville', 'US', '{}', 'imported', true, NULL),
  ('St Paul''s School Concord', 'Concord', 'US', '{}', 'imported', true, NULL),
  ('Groton School', 'Groton', 'US', '{}', 'imported', true, NULL),
  ('Milton Academy', 'Milton', 'US', '{}', 'imported', true, NULL),
  ('Trinity School New York', 'New York', 'US', '{}', 'imported', true, NULL),
  ('Horace Mann School', 'New York', 'US', '{}', 'imported', true, NULL),
  ('Marlborough School Los Angeles', 'Los Angeles', 'US', '{}', 'imported', true, NULL),
  ('Harvard-Westlake School', 'Los Angeles', 'US', '{}', 'imported', true, NULL),
  ('Polytechnic School', 'Pasadena', 'US', '{}', 'imported', true, NULL),
  ('Nueva School', 'Hillsborough', 'US', '{}', 'imported', true, NULL),

  -- ──────────────────────────────────────────────────────────────────────
  -- Asia non-China fill-ins (gaps in 085 seed). Matt's IB Asia conference
  -- circuit + AustCham regional chapters.
  -- ──────────────────────────────────────────────────────────────────────
  ('American School in Japan', 'Tokyo', 'JP', '{}', 'imported', true, NULL),
  ('Saint Maur International School', 'Yokohama', 'JP', '{MYP,DP,PYP}', 'imported', true, NULL),
  ('Korea International School Jeju', 'Jeju', 'KR', '{DP}', 'imported', true, NULL),
  ('Branksome Hall Asia', 'Jeju', 'KR', '{MYP,DP,PYP}', 'imported', true, NULL),
  ('Bangkok Patana School', 'Bangkok', 'TH', '{DP}', 'imported', true, NULL),
  ('Harrow International School Bangkok', 'Bangkok', 'TH', '{}', 'imported', true, NULL),
  ('Garden International School Kuala Lumpur', 'Kuala Lumpur', 'MY', '{}', 'imported', true, NULL),
  ('Alice Smith School', 'Kuala Lumpur', 'MY', '{}', 'imported', true, NULL),
  ('Marlborough College Malaysia', 'Iskandar Puteri', 'MY', '{}', 'imported', true, NULL),
  ('Saigon South International School', 'Ho Chi Minh City', 'VN', '{DP}', 'imported', true, NULL),
  ('British International School Hanoi', 'Hanoi', 'VN', '{DP}', 'imported', true, NULL),
  ('International School of Phnom Penh', 'Phnom Penh', 'KH', '{DP}', 'imported', true, NULL),
  ('Mahindra United World College of India', 'Pune', 'IN', '{DP}', 'imported', true, NULL),
  ('Woodstock School', 'Mussoorie', 'IN', '{DP}', 'imported', true, NULL),
  ('Doon School', 'Dehradun', 'IN', '{}', 'imported', true, NULL),

  -- ──────────────────────────────────────────────────────────────────────
  -- Europe non-UK fill-ins.
  -- ──────────────────────────────────────────────────────────────────────
  ('International School of Brussels', 'Brussels', 'BE', '{MYP,DP,PYP}', 'imported', true, NULL),
  ('British School of Brussels', 'Tervuren', 'BE', '{DP}', 'imported', true, NULL),
  ('Leysin American School', 'Leysin', 'CH', '{DP}', 'imported', true, NULL),
  ('Aiglon College', 'Chesières-Villars', 'CH', '{DP}', 'imported', true, NULL),
  ('Institut Le Rosey', 'Rolle', 'CH', '{DP}', 'imported', true, NULL),
  ('International School of Hamburg', 'Hamburg', 'DE', '{MYP,DP,PYP}', 'imported', true, NULL),
  ('Bonn International School', 'Bonn', 'DE', '{MYP,DP,PYP}', 'imported', true, NULL),
  ('International School of Düsseldorf', 'Düsseldorf', 'DE', '{MYP,DP,PYP}', 'imported', true, NULL),
  ('École Active Bilingue Jeannine Manuel', 'Paris', 'FR', '{DP}', 'imported', true, NULL),
  ('International School of Helsinki', 'Helsinki', 'FI', '{MYP,DP,PYP}', 'imported', true, NULL),

  -- ──────────────────────────────────────────────────────────────────────
  -- Middle East / Africa fill-ins.
  -- ──────────────────────────────────────────────────────────────────────
  ('Dubai American Academy', 'Dubai', 'AE', '{DP}', 'imported', true, NULL),
  ('Dwight School Dubai', 'Dubai', 'AE', '{MYP,DP,PYP}', 'imported', true, NULL),
  ('Jumeirah College', 'Dubai', 'AE', '{}', 'imported', true, NULL),
  ('American School of Doha', 'Doha', 'QA', '{DP}', 'imported', true, NULL),
  ('Doha College', 'Doha', 'QA', '{}', 'imported', true, NULL),
  ('American Community School Beirut', 'Beirut', 'LB', '{DP}', 'imported', true, NULL),
  ('American International School of Lagos', 'Lagos', 'NG', '{DP}', 'imported', true, NULL),
  ('Hillcrest School Jos', 'Jos', 'NG', '{}', 'imported', true, NULL),

  -- ──────────────────────────────────────────────────────────────────────
  -- New Zealand + Canada small fill-ins.
  -- ──────────────────────────────────────────────────────────────────────
  ('Kristin School', 'Auckland', 'NZ', '{MYP,DP,PYP}', 'imported', true, NULL),
  ('St Cuthbert''s College Auckland', 'Auckland', 'NZ', '{DP}', 'imported', true, NULL),
  ('Diocesan School for Girls Auckland', 'Auckland', 'NZ', '{}', 'imported', true, NULL),
  ('Upper Canada College', 'Toronto', 'CA', '{DP}', 'imported', true, NULL),
  ('Havergal College', 'Toronto', 'CA', '{}', 'imported', true, NULL),
  ('St Andrew''s College Aurora', 'Aurora', 'CA', '{}', 'imported', true, NULL),
  ('Appleby College', 'Oakville', 'CA', '{DP}', 'imported', true, NULL),
  ('Crescent School', 'Toronto', 'CA', '{}', 'imported', true, NULL)

ON CONFLICT (normalized_name, country) DO NOTHING;

-- Sanity check
DO $$
DECLARE
  v_imported_count INT;
  v_total_count INT;
BEGIN
  SELECT COUNT(*) INTO v_imported_count FROM schools WHERE source='imported';
  SELECT COUNT(*) INTO v_total_count FROM schools;
  RAISE NOTICE 'Phase 4.1 schools seed extension: % source=imported entries (% total schools)',
    v_imported_count, v_total_count;
END $$;
