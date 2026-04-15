-- Seed data for migration 085: schools
--
-- Starter set of well-known IB MYP schools worldwide. Focused on
-- StudioLoom's target audience (MYP Design teachers) with extra density in
-- Matt's immediate zone (China/Asia) so his own login typeahead finds
-- a match.
--
-- source='ibo' and verified=true — hand-curated, not scraped.
-- Can be expanded over time via (a) bulk import from IBO directory scrape,
-- (b) user_submitted entries promoted to verified by admin.
--
-- This seed uses ISO 3166-1 alpha-2 country codes.

-- Guard against re-running (normalized_name + country unique constraint
-- will reject duplicates cleanly; ON CONFLICT DO NOTHING is belt-and-braces).

INSERT INTO schools (name, city, country, ib_programmes, source, verified, created_by)
VALUES
  -- ── China (Matt's region, high density) ──
  ('Nanjing International School', 'Nanjing', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Shanghai American School Pudong', 'Shanghai', 'CN', '{DP}', 'ibo', true, NULL),
  ('Shanghai American School Puxi', 'Shanghai', 'CN', '{DP}', 'ibo', true, NULL),
  ('Western International School of Shanghai', 'Shanghai', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Shanghai United International School Hongqiao', 'Shanghai', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Suzhou Singapore International School', 'Suzhou', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Dulwich College Suzhou', 'Suzhou', 'CN', '{MYP,DP}', 'ibo', true, NULL),
  ('Beijing International School', 'Beijing', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Western Academy of Beijing', 'Beijing', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('International School of Beijing', 'Beijing', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Yew Chung International School of Beijing', 'Beijing', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Hangzhou International School', 'Hangzhou', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Dulwich College Shanghai Pudong', 'Shanghai', 'CN', '{DP}', 'ibo', true, NULL),
  ('Yew Chung International School of Shanghai', 'Shanghai', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Concordia International School Shanghai', 'Shanghai', 'CN', '{DP}', 'ibo', true, NULL),
  ('Shekou International School', 'Shenzhen', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('QSI International School of Shenzhen', 'Shenzhen', 'CN', '{DP}', 'ibo', true, NULL),
  ('Guangzhou Nanfang International School', 'Guangzhou', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('American International School of Guangzhou', 'Guangzhou', 'CN', '{DP}', 'ibo', true, NULL),
  ('Utahloy International School Zengcheng', 'Guangzhou', 'CN', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── Hong Kong ──
  ('Chinese International School', 'Hong Kong', 'HK', '{MYP,DP}', 'ibo', true, NULL),
  ('Canadian International School of Hong Kong', 'Hong Kong', 'HK', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('German Swiss International School', 'Hong Kong', 'HK', '{DP}', 'ibo', true, NULL),
  ('Hong Kong International School', 'Hong Kong', 'HK', '{DP}', 'ibo', true, NULL),
  ('Li Po Chun United World College of Hong Kong', 'Hong Kong', 'HK', '{DP}', 'ibo', true, NULL),

  -- ── Singapore ──
  ('United World College of South East Asia Dover', 'Singapore', 'SG', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('United World College of South East Asia East', 'Singapore', 'SG', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Singapore American School', 'Singapore', 'SG', '{DP}', 'ibo', true, NULL),
  ('Stamford American International School', 'Singapore', 'SG', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Tanglin Trust School', 'Singapore', 'SG', '{DP}', 'ibo', true, NULL),
  ('Australian International School Singapore', 'Singapore', 'SG', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Canadian International School Singapore', 'Singapore', 'SG', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── Japan ──
  ('International School of the Sacred Heart', 'Tokyo', 'JP', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Yokohama International School', 'Yokohama', 'JP', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Canadian Academy', 'Kobe', 'JP', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Osaka International School of Kwansei Gakuin', 'Osaka', 'JP', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Nagoya International School', 'Nagoya', 'JP', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── South Korea ──
  ('Seoul Foreign School', 'Seoul', 'KR', '{MYP,DP}', 'ibo', true, NULL),
  ('Korea International School', 'Seongnam', 'KR', '{DP}', 'ibo', true, NULL),
  ('Dwight School Seoul', 'Seoul', 'KR', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── SE Asia ──
  ('Jakarta Intercultural School', 'Jakarta', 'ID', '{DP}', 'ibo', true, NULL),
  ('International School Bangkok', 'Bangkok', 'TH', '{DP}', 'ibo', true, NULL),
  ('NIST International School', 'Bangkok', 'TH', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('International School of Kuala Lumpur', 'Kuala Lumpur', 'MY', '{DP}', 'ibo', true, NULL),
  ('Mont''Kiara International School', 'Kuala Lumpur', 'MY', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('International School Manila', 'Manila', 'PH', '{DP}', 'ibo', true, NULL),
  ('United Nations International School of Hanoi', 'Hanoi', 'VN', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── South Asia / Middle East ──
  ('American School of Bombay', 'Mumbai', 'IN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('American Embassy School New Delhi', 'New Delhi', 'IN', '{DP}', 'ibo', true, NULL),
  ('UWC Mahindra College', 'Pune', 'IN', '{DP}', 'ibo', true, NULL),
  ('The International School Bangalore', 'Bangalore', 'IN', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('American School in Dubai', 'Dubai', 'AE', '{DP}', 'ibo', true, NULL),
  ('Dubai College', 'Dubai', 'AE', '{DP}', 'ibo', true, NULL),
  ('GEMS World Academy Dubai', 'Dubai', 'AE', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── Europe flagships ──
  ('International School of Geneva', 'Geneva', 'CH', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('United World College of the Atlantic', 'Llantwit Major', 'GB', '{DP}', 'ibo', true, NULL),
  ('United World College Maastricht', 'Maastricht', 'NL', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('International School of Amsterdam', 'Amstelveen', 'NL', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('American School of Paris', 'Saint-Cloud', 'FR', '{DP}', 'ibo', true, NULL),
  ('Frankfurt International School', 'Frankfurt', 'DE', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Munich International School', 'Munich', 'DE', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Vienna International School', 'Vienna', 'AT', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('International School of Stockholm', 'Stockholm', 'SE', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Copenhagen International School', 'Copenhagen', 'DK', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── UK ──
  ('ACS Cobham International School', 'Cobham', 'GB', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Sevenoaks School', 'Sevenoaks', 'GB', '{DP}', 'ibo', true, NULL),
  ('Southbank International School', 'London', 'GB', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('International School of London', 'London', 'GB', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── Americas ──
  ('United Nations International School', 'New York', 'US', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Riverdale Country School', 'New York', 'US', '{DP}', 'ibo', true, NULL),
  ('International School of the Americas', 'San Antonio', 'US', '{DP}', 'ibo', true, NULL),
  ('George Mason High School', 'Falls Church', 'US', '{DP}', 'ibo', true, NULL),
  ('Lester B. Pearson United World College of the Pacific', 'Victoria', 'CA', '{DP}', 'ibo', true, NULL),
  ('Branksome Hall', 'Toronto', 'CA', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('American School of Rio de Janeiro', 'Rio de Janeiro', 'BR', '{DP}', 'ibo', true, NULL),
  ('Graded - The American School of São Paulo', 'São Paulo', 'BR', '{DP}', 'ibo', true, NULL),

  -- ── Australia / NZ ──
  ('International Grammar School', 'Sydney', 'AU', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Mercedes College', 'Adelaide', 'AU', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Presbyterian Ladies'' College Sydney', 'Sydney', 'AU', '{DP}', 'ibo', true, NULL),
  ('Queenwood School for Girls', 'Sydney', 'AU', '{DP}', 'ibo', true, NULL),
  ('The King''s School', 'Sydney', 'AU', '{DP}', 'ibo', true, NULL),
  ('Wesley College', 'Melbourne', 'AU', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('ACG Parnell College', 'Auckland', 'NZ', '{MYP,DP,PYP}', 'ibo', true, NULL),

  -- ── Africa ──
  ('International School of Kenya', 'Nairobi', 'KE', '{DP}', 'ibo', true, NULL),
  ('American International School of Johannesburg', 'Johannesburg', 'ZA', '{DP}', 'ibo', true, NULL),
  ('International Community School of Addis Ababa', 'Addis Ababa', 'ET', '{MYP,DP,PYP}', 'ibo', true, NULL),
  ('Cairo American College', 'Cairo', 'EG', '{DP}', 'ibo', true, NULL)

ON CONFLICT (normalized_name, country) DO NOTHING;

-- Sanity check
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM schools WHERE source='ibo';
  RAISE NOTICE 'Schools seed: % IB schools inserted (verified=true)', v_count;
END $$;
