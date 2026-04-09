-- ============================================================
-- StudioLoom: Virtual Studio & Multiplayer Gallery
-- Supabase Migration
-- ============================================================

-- ── STUDIO PROFILES ──────────────────────────────────────────
-- Each student has a customizable virtual studio
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  
  -- Customization
  theme_id text not null default 'workshop',        -- workshop | gallery | greenhouse | custom
  display_name text not null,                         -- "Alex Chen's Studio"
  bio text,                                           -- short student intro
  avatar_emoji text default '🎨',
  
  -- Access control
  access_code text not null default upper(substr(md5(random()::text), 1, 4) || '-' || substr(md5(random()::text), 1, 2)),
  is_public boolean not null default false,           -- if true, no code needed
  
  -- Gamification display
  belt_level text default 'apprentice',               -- apprentice | journeyman | artisan | master
  xp_total int default 0,
  journal_streak int default 0,
  
  -- Layout preferences (JSON for flexible config)
  layout_config jsonb default '{"project_order": [], "featured_project": null, "show_badges": true, "show_stats": true}'::jsonb,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint studios_student_unique unique (student_id)
);

-- Index for access code lookups (visitor entry)
create unique index idx_studios_access_code on public.studios(access_code);
create index idx_studios_student on public.studios(student_id);

-- ── STUDIO DISPLAY ITEMS ─────────────────────────────────────
-- Which projects/works are "on display" in the studio
create table public.studio_displays (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  
  -- Display config
  position int not null default 0,                    -- ordering on the wall
  frame_style text default 'default',                 -- default | ornate | minimal | none
  spotlight_color text,                               -- hex color override, null = use project phase color
  caption text,                                       -- student's curatorial note
  
  -- Journal excerpt to show visitors
  journal_excerpt text,
  
  created_at timestamptz not null default now(),
  
  constraint studio_displays_unique unique (studio_id, project_id)
);

create index idx_studio_displays_studio on public.studio_displays(studio_id);

-- ── STUDIO BADGES ────────────────────────────────────────────
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                          -- 'first-crit', '7-day-streak', etc.
  name text not null,
  description text not null,
  icon text not null,                                 -- emoji
  category text not null default 'general',           -- general | design | social | streak
  xp_value int not null default 10,
  created_at timestamptz not null default now()
);

create table public.student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  
  constraint student_badges_unique unique (student_id, badge_id)
);

-- ── GALLERY EVENTS (Exhibition Nights) ───────────────────────
create table public.gallery_events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  
  title text not null,                                -- "MYP4 Design Exhibition Night"
  description text,
  
  -- Scheduling
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_live boolean not null default false,             -- flipped on/off by teacher
  
  -- Gallery config
  room_theme text not null default 'exhibition',      -- exhibition | museum | warehouse | outdoor
  room_size text not null default 'medium',           -- small | medium | large
  max_visitors int default 50,
  
  -- Access
  invite_code text not null default upper(substr(md5(random()::text), 1, 6)),
  allow_guest_access boolean default true,            -- parents can join with code
  
  -- Teacher who created it
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_gallery_events_invite on public.gallery_events(invite_code);

-- Which studios are featured in a gallery event
create table public.gallery_event_studios (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gallery_events(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  
  -- Position in the gallery room
  wall_position int not null,                         -- 0-based slot on gallery walls
  
  constraint gallery_event_studios_unique unique (event_id, studio_id)
);

-- ── REACTIONS ────────────────────────────────────────────────
-- Emoji reactions on displayed works (aggregated for performance)
create table public.artwork_reactions (
  id uuid primary key default gen_random_uuid(),
  display_id uuid not null references public.studio_displays(id) on delete cascade,
  event_id uuid references public.gallery_events(id) on delete set null,  -- null = from personal studio visit
  
  emoji text not null,                                -- ❤️ 🔥 👏 ⭐ 💡 🎨
  reactor_name text,                                  -- visitor display name (may not have account)
  reactor_id uuid references public.profiles(id) on delete set null,
  
  created_at timestamptz not null default now()
);

create index idx_reactions_display on public.artwork_reactions(display_id);
create index idx_reactions_event on public.artwork_reactions(event_id);

-- Materialized count view for fast reads
create or replace view public.reaction_counts as
select 
  display_id,
  emoji,
  count(*) as count
from public.artwork_reactions
group by display_id, emoji;

-- ── GUESTBOOK ────────────────────────────────────────────────
create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  
  visitor_name text not null,
  visitor_role text default 'visitor',                -- parent | teacher | student | visitor
  message text not null check (char_length(message) <= 500),
  emoji text default '👋',
  
  -- Moderation
  is_approved boolean not null default true,          -- teacher can require approval
  is_flagged boolean not null default false,
  
  -- Optional auth link
  visitor_id uuid references public.profiles(id) on delete set null,
  
  created_at timestamptz not null default now()
);

create index idx_guestbook_studio on public.guestbook_entries(studio_id);

-- ── GALLERY CHAT MESSAGES ────────────────────────────────────
-- Persisted chat for gallery events (Realtime handles live delivery)
create table public.gallery_chat (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gallery_events(id) on delete cascade,
  
  sender_name text not null,
  sender_color text not null default '#e94560',
  sender_role text not null default 'visitor',
  message text not null check (char_length(message) <= 200),
  
  sender_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_gallery_chat_event on public.gallery_chat(event_id, created_at);

-- ── VISIT ANALYTICS ──────────────────────────────────────────
-- Track studio visits for student/teacher insights
create table public.studio_visits (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  
  visitor_name text,
  visitor_role text default 'visitor',
  visitor_id uuid references public.profiles(id) on delete set null,
  
  -- Session tracking
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  
  -- Which works did they look at?
  works_viewed uuid[] default '{}',                   -- array of display_ids
  reactions_given int default 0,
  guestbook_signed boolean default false,
  
  -- Context
  event_id uuid references public.gallery_events(id) on delete set null,
  access_method text default 'code'                   -- code | public | event
);

create index idx_visits_studio on public.studio_visits(studio_id);
create index idx_visits_event on public.studio_visits(event_id);


-- ── ROW LEVEL SECURITY ───────────────────────────────────────

alter table public.studios enable row level security;
alter table public.studio_displays enable row level security;
alter table public.artwork_reactions enable row level security;
alter table public.guestbook_entries enable row level security;
alter table public.gallery_events enable row level security;
alter table public.gallery_chat enable row level security;
alter table public.studio_visits enable row level security;

-- Studios: owner can CRUD, anyone with code can read
create policy "Students manage own studio"
  on public.studios for all
  using (auth.uid() = student_id);

create policy "Anyone can read public studios"
  on public.studios for select
  using (is_public = true);

-- Displays: owner manages, visitors read via studio access
create policy "Students manage own displays"
  on public.studio_displays for all
  using (
    studio_id in (select id from public.studios where student_id = auth.uid())
  );

create policy "Visitors can view displays"
  on public.studio_displays for select
  using (true);  -- access gated at application layer via studio code

-- Reactions: anyone can insert, read all
create policy "Anyone can react"
  on public.artwork_reactions for insert
  with check (true);

create policy "Anyone can read reactions"
  on public.artwork_reactions for select
  using (true);

-- Guestbook: anyone can insert, studio owner + visitors can read
create policy "Anyone can sign guestbook"
  on public.guestbook_entries for insert
  with check (true);

create policy "Anyone can read guestbook"
  on public.guestbook_entries for select
  using (true);

-- Gallery events: teacher manages, participants read
create policy "Teachers manage events"
  on public.gallery_events for all
  using (auth.uid() = created_by);

create policy "Anyone can read live events"
  on public.gallery_events for select
  using (is_live = true);

-- Chat: insert if event is live, read all for event
create policy "Anyone can chat in live events"
  on public.gallery_chat for insert
  with check (
    event_id in (select id from public.gallery_events where is_live = true)
  );

create policy "Anyone can read event chat"
  on public.gallery_chat for select
  using (true);


-- ── FUNCTIONS ────────────────────────────────────────────────

-- Regenerate studio access code
create or replace function public.regenerate_studio_code(studio_uuid uuid)
returns text
language plpgsql
security definer
as $$
declare
  new_code text;
begin
  new_code := upper(substr(md5(random()::text), 1, 4) || '-' || substr(md5(random()::text), 1, 2));
  
  update public.studios 
  set access_code = new_code, updated_at = now()
  where id = studio_uuid and student_id = auth.uid();
  
  return new_code;
end;
$$;

-- Lookup studio by access code (for visitor entry)
create or replace function public.enter_studio(code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'studio_id', s.id,
    'display_name', s.display_name,
    'theme_id', s.theme_id,
    'belt_level', s.belt_level,
    'xp_total', s.xp_total,
    'avatar_emoji', s.avatar_emoji,
    'bio', s.bio,
    'displays', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'project_id', d.project_id,
          'position', d.position,
          'frame_style', d.frame_style,
          'caption', d.caption,
          'journal_excerpt', d.journal_excerpt
        ) order by d.position
      ), '[]'::jsonb)
      from public.studio_displays d where d.studio_id = s.id
    ),
    'badges', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'name', b.name,
          'icon', b.icon,
          'description', b.description,
          'earned_at', sb.earned_at
        )
      ), '[]'::jsonb)
      from public.student_badges sb
      join public.badges b on b.id = sb.badge_id
      where sb.student_id = s.student_id
    )
  ) into result
  from public.studios s
  where upper(s.access_code) = upper(code);
  
  return result;
end;
$$;


-- ── SEED: DEFAULT BADGES ─────────────────────────────────────

insert into public.badges (slug, name, description, icon, category, xp_value) values
  ('first-crit',      'First Crit',        'Gave your first peer review',              '🎯', 'social',  10),
  ('7-day-streak',    '7-Day Streak',      'Logged process journal 7 days straight',   '🔥', 'streak',  25),
  ('artisan-belt',    'Artisan Belt',       'Reached Artisan design level',             '⭐', 'design',  50),
  ('prototype-master','Prototype Master',   'Completed 5 prototypes',                   '🧪', 'design',  30),
  ('design-spark',    'Design Spark',       'Won a Daily Design Spark challenge',       '💡', 'general', 15),
  ('mentor',          'Studio Mentor',      'Helped 3 peers in Studio Crits',           '🤝', 'social',  40),
  ('exhibition-star', 'Exhibition Star',    'Featured in a Gallery Exhibition',          '🌟', 'general', 35),
  ('guestbook-10',    'Popular Studio',     'Received 10 guestbook entries',            '📖', 'social',  20),
  ('full-cycle',      'Full Cycle',         'Completed all 4 Design Cycle phases',      '🔄', 'design',  45),
  ('react-magnet',    'Reaction Magnet',    'Received 50 reactions on displayed works', '❤️', 'social',  30)
on conflict (slug) do nothing;
