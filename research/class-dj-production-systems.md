# Class DJ — Prior Art Deep Research

**Purpose:** Pre-flight reference for the developer designing "Class DJ" — a 3–30-student classroom voting feature (mood + energy + veto + seed-artist in ~60s) that synthesises three music suggestions a teacher picks from, repeating many times per term.

**Method:** ~16 targeted web searches across academic papers, post-mortems, Reddit/HN threads, Spotify Community forums, and industry coverage. Each system below is summarised against six lenses: algorithm, conflict handling, fairness mechanism, what worked, what failed, transferable lesson.

---

## 1. Spotify Blend (2021 – present)

**Algorithm.** Blend mashes the listening histories of 2–10 friends into one auto-updating playlist. Spotify's engineering blog explicitly names four optimisation targets: **relevance, coherence, equality, democratic decisions**. Songs are weighted by playcount per user and merged; exact ratios are proprietary, but post-hoc reverse-engineering by users suggests it favours each person's *high-playcount recent tracks*. A "taste match %" is computed from cosine-style similarity between the two histories.

**Conflict handling.** Implicit: if tastes diverge, the algorithm tends to over-rotate the *more active* listener (more recent plays = more candidate signal). There is no explicit veto or weighting input.

**Fairness mechanism.** None visible to the user. The 50/50 split is implied, not enforced. No way to mark a song "no, never for me."

**What worked.** Low-friction onboarding (single invite link); the social hook of seeing your taste-match % is sticky. The Spotify Design team explicitly say it was built as a **conversation starter**, not a precise recommender — and as a conversation starter it succeeds.

**What failed.** The two loudest complaints across Spotify Community + Reddit:
- **Algorithm contamination.** "Blends absolutely destroy your algorithm" — using a Blend for daily listening trains Spotify's per-user model on songs you didn't pick. Multiple users report that *their* Discover Weekly becomes their partner's taste after a few weeks. This is a **feedback-loop poisoning** problem the system does not isolate.
- **Stale refresh.** Updates "1 or 2 songs daily" or not at all; multiple top community threads titled "Blend playlist is not updated" with months of identical tracks. The system optimises for stability over freshness, which kills repeat usefulness.
- **Same playlist for different friends.** Users report that two Blends with different people have largely identical track lists in different orders — suggesting the algorithm anchors heavily on the user's own top tracks and treats the partner as a small perturbation.

**Lesson for Class DJ.** Don't let the social feature pollute the individual taste model. **Isolate Class DJ votes from any personal recommendation feedback loop.** Also: if the system is meant to be used repeatedly, "freshness" is a first-class spec property — Blend's failure mode is exactly the failure mode "same class many times per term" will hit.

---

## 2. Spotify Jam (Sep 2023 – present)

**Algorithm.** Real-time shared queue. Host starts; up to 32 guests join by NFC, link, or proximity. Anyone can add to queue or vote tracks down. Spotify's own AI fills idle queue space using guests' combined tastes.

**Conflict handling.** Host has unilateral override: can re-order, remove, or strip "Guest controls" so others can only *queue* not skip/reorder.

**Fairness mechanism.** Two-tier permission model (Host / Guests). No per-guest vote weighting, no rotation, no anti-domination logic. **Actions are anonymous in the UI** — you cannot see who skipped your song.

**What worked.** Speaker-proximity join (especially via Bluetooth/Connect device) is genuinely magic in person. The AI fill-in handles dead-queue gracefully.

**What failed.** A widely-cited 2024 case study ("Play my damn song!" — Nathalie Van Raemdonck) documents the failure mode: **anonymity + collective action = invisible griefing**. Quotes from real users:
- "Someone in a building kept joining a jam and playing horror screamo music on a speaker." (proximity-join hijack)
- People drag opponents' tracks to the bottom of the queue so they never play.
- Skip actions are not attributable, so social repair is impossible — you can't say "Sam, stop skipping me" because you don't know it's Sam.

The Spotify Community has multiple threads asking for a way to **disable Jam entirely** because it kept activating when friends were nearby.

**Lesson for Class DJ.** **Attribute votes to identities the room can see.** Anonymous voting in a *persistent group* (vs anonymous strangers) creates worse social outcomes than identified voting — the social repair mechanism is what you want, not anonymity. In a classroom this aligns naturally: students aren't anonymous to each other; the teacher isn't a "host" but a final-call moderator.

---

## 3. plug.dj (2012 – 2021, RIP twice)

**Algorithm.** No aggregation — instead, **DJ rotation**: users queued up to play one track each from YouTube/SoundCloud. Audience voted "Woot" (like) or "Meh" (skip). Sufficient Mehs skipped the song; sufficient Woots earned DJ "props."

**Conflict handling.** Room-level — community moderators (humans) could boot/ban genre-trolls. Distinct "communities" (rooms) self-organised by taste (a "post-hardcore room," a "lofi room," etc.). Conflict was resolved by **exit, not voice**: if the room culture didn't suit you, leave.

**Fairness mechanism.** The DJ rotation queue itself — everyone waits their turn. Time-based fairness, not preference-weighted.

**What worked.** The Wikipedia + Tiny Mix Tapes coverage emphasises that plug.dj built **real communities of millions** with 20k new users/day at peak. The *waiting in queue* creates anticipation and accountability — you have one shot, so you pick well.

**What failed.** Two big modes:
1. **Bot moderation arms race.** Within a year, "Boothoven" and similar bots auto-booted users playing off-genre tracks faster than humans could moderate. Power-users ran rooms; ordinary users found rooms felt gatekept and unwelcoming. The Radio Survivor post-mortem ("The perils of a young audience") explicitly blames a culture where the **median user couldn't pay** (under-18, no card) — moderation tools concentrated in the hands of a smaller subscriber elite.
2. **Financial.** Music licensing + a non-paying audience killed it. Shut once in 2015, revived, died again 2021.

**Lesson for Class DJ.** **Time-based rotation as a fairness baseline beats any clever aggregation algorithm** for repeated group sessions. Even if your aggregation logic is "fair on this round," over many rounds a class will perceive fairness through *who got their pick last time* — track that. (Also: plug.dj's death-by-moderation-creep is a warning about giving any user role too much veto power. The teacher is the safe asymmetric authority here — use that.)

---

## 4. turntable.fm / TT.fm / Hangout (2011 – 2013, revived 2021 + 2024)

**Algorithm.** Same DJ-rotation model plug.dj copied: up to 5 DJs on "stage," audience clicks "Awesome" or "Lame." Lame-threshold skips the song; Awesome earns DJ points. DJ slot rotates after one track.

**Conflict handling.** Genre rooms (audience self-selects). User-created moderation bots enforced room rules. **No algorithmic conflict resolution** — it was all social.

**Fairness mechanism.** The DJ stage itself: only 5 slots, FIFO queue for waiting DJs, one track per turn. Audience-as-jury via Awesome/Lame.

**What worked.** Cultural moment in 2011 — "social DJ" as a category was invented here. The 5-DJ stage created **identifiable performers** (the opposite of Spotify Jam's anonymity) — you knew who played the great track and could "Awesome" them by name.

**What failed.** Per the failory.com post-mortem + Vice "Bring Back Turntable.fm":
- **Audience engagement collapse.** Most users wanted to be DJs, not audience. When you're not on stage, you're staring at avatars bobbing. The 4:1 audience:DJ ratio felt unfair to the audience.
- **Royalties.** Spent ~25% of funds on legal/royalties — fatal for an ad-free social product.
- **Moderation by bot.** Power users ran the rooms; casual users churned. Same dynamic as plug.dj.
- **The 2024 Hangout reboot** explicitly cites these problems and is building "gamification + custom avatars + identifiable DJs" as the fix — but the founders famously split, and there are now *two* competing turntable revivals (Deepcut.fm + Hangout) with no clear winner.

**Lesson for Class DJ.** **Identifiable contribution beats anonymous voting for repeat-session retention.** If a student's name flashes when their seed-artist gets picked, that's a tiny dopamine hit worth more than any algorithm tweak. But also: don't make audience role feel passive — Class DJ's 60-second voting *is* the audience role, so make sure even non-winning voters get acknowledgement ("3 students also voted moody/low-energy — saved as a future suggestion").

---

## 5. JQBX (Spotify-backed group rooms, 2017 – present)

**Algorithm.** Same DJ rotation + thumbs-up/down per track. Critically, the **skip threshold is dynamic** — based on percentage of active voters in the last 30 minutes, on a log scale.

**Conflict handling.** Rooms self-select by genre/vibe. Persistent "regulars" enforce norms socially.

**Fairness mechanism.** The dynamic threshold is the interesting bit. A GitHub issue from the maintainer (Jason Zigelbaum) discusses making skip = "downvotes > 25% of distinct voters in last 30 min" precisely because in **large rooms (50+) downvotes never accumulate enough to skip**, and in **small rooms (3) one downvote feels like a veto**. Same problem Class DJ will face — 3-student class vs 30-student class need different math.

**What worked.** The Spotify-integrated catalog (full licensed music, no copyright headaches). Stable for 8+ years, which is rare in this space.

**What failed.** Per JQBX's own GitHub issues:
- **Downvote button creates DJ anxiety.** Issue #199 ("Rework/Disable down-vote button") quotes users saying it "scares people off from playing 'off-topic' or 'unusual' songs." Negative voting suppresses adventurous picks. JQBX considered removing the button entirely.
- **Skip threshold tuning is hard.** Issue #127 documents that for years, large rooms physically couldn't skip — the threshold was a flat number that small rooms blew through but large rooms never reached. Took multiple iterations to land on the log-scale fix.

**Lesson for Class DJ.** **The negative signal is dangerous.** A "veto" button feels democratic but makes students self-censor toward safe picks — the opposite of what a music-discovery feature wants. If you have veto, make it *cost* something (limited per term, requires reason, etc.) so it's used sparingly. Also: any vote threshold must scale with class size — 3 students and 30 students are different problems.

---

## 6. MusicFX (McCarthy & Anagnost, PARC/Andersen, CSCW 1998) — the canonical paper

**Algorithm.** Deployed in an Accenture fitness centre in Northbrook IL from 1997–2002. Members rated 91 genres on a **5-point scale (-2 hate, -1 dislike, 0 neutral, +1 like, +2 love)**. Each radio station was tagged by genre. A RFID badge system detected who was currently in the gym. For each track-selection event:

1. Sum each station's rating across **currently-present members**.
2. Square the sum (`s²`) — this *non-linearly amplifies strong consensus* (a station that everyone rates +2 outweighs one with mixed +1/+1/+1/+1 votes).
3. Negative sums are zeroed out (no negative weights).
4. Pick a station via **weighted random selection** over the squared sums.
5. Bias against the last-played station to ensure rotation.

So MusicFX is *neither pure average nor least-misery* — it's **weighted approval with quadratic consensus boost + recency penalty**. The randomness is intentional: it (a) ensures no single dominant genre always wins, (b) introduces variety, (c) makes the system feel less like a tyrant.

**Conflict handling.** Quadratic weighting means a single "-2 hate" doesn't veto, but four people all rating +2 quickly dominates. Genuinely-split groups produce noisier outputs (good — surfaces diversity).

**Fairness mechanism.** Three layers: (1) sum across only *present* members; (2) recency penalty against the last-played station prevents one genre running away; (3) randomness in selection means even lower-weighted stations occasionally play, so minorities aren't permanently starved.

**What worked.** **71% of users preferred MusicFX music vs the previous (manager-selected) music. Only 7% thought it was worse. Nearly half cited "increased variety" as the key benefit.** Deployed for 5+ years — longest-running production group-music-recommender in academic literature. McCarthy's follow-up CSCW 2000 paper confirms sustained satisfaction.

**What failed.** Hard to find criticism — the system was *small-scale and indoors* (one gym), so social trolling vectors were limited by physical accountability. Cold-start problem: new members had to enter 91 genre ratings (the paper notes this as friction). The genre taxonomy itself dated badly (5-year deployment, no taxonomy updates).

**Lesson for Class DJ — and the most important lesson in this report.** **Weighted random selection with a recency penalty is the single most battle-tested group-music algorithm in the literature.** It elegantly solves three things Class DJ needs:
1. No single student dominates (random selection + recency penalty).
2. Strong consensus wins quickly (quadratic boost), but minority tastes occasionally surface.
3. The teacher's final pick *is* a recency event — naturally penalise the same student/seed-artist/mood combo from winning next round.

This is the algorithm to clone. The 60-second mood+energy vote is your equivalent of MusicFX's genre matrix.

---

## 7. GroupFun (Popescu & Pu, EPFL, 2012–2013)

**Algorithm.** Probabilistic Weighted Sum (PWS). Each user rates songs; group score is a weighted sum with weights tuned to favour **diversity** and **manipulation-resistance**. Built explicitly on game-theoretic principles: incentives for truthful preference reporting (don't lie about your taste to game the outcome).

**Conflict handling.** The PWS weighting deliberately under-weights extreme outliers, which prevents one user from dominating by lying ("I love this song with infinite intensity"). Diversity bias means even minority-preferred tracks have a non-zero probability of selection.

**Fairness mechanism.** Three explicit design goals: elicit truthful preferences, maximise group satisfaction, resist manipulation.

**What worked.** As a research demo, the manipulation-resistance result is solid. Showed PWS beats simple average for diverse groups.

**What failed.** Never escaped academia. Facebook app shut down. The "truthful preference elicitation" framing is academically interesting but UX-hostile — students don't think of themselves as strategic agents; they think "I want this song."

**Lesson for Class DJ.** **Manipulation-resistance is a real concern even in a classroom** — students will absolutely try to game a system (vote for "metal at max energy" every round to grief). Build a small manipulation-cost in: per-student vote weight slightly decays if they consistently vote at extremes, or extreme-extreme votes need a teacher acknowledgement. But don't go full game-theory — keep the UX feeling like "tap your mood," not "submit your strategy."

---

## 8. Other systems (briefer)

**Jukola** (O'Hara et al., 2004, public bar deployment). Public-display nomination + handheld voting. Findings: the *visibility of the voting process* generated more social value than the music selection itself. People discussed and competed around votes. **Lesson:** Show the vote tally live during the 60 seconds — the discussion is the feature, not just the song.

**FlyTrap** (Crossen et al., 2002). Used per-user iTunes-history sensing + RFID presence to auto-construct a room soundtrack. Implicit-preference model — no explicit voting. **Lesson:** A *seed-artist* slot in Class DJ is the modern equivalent of "what's actually in your library" — implicit preference is more honest than explicit voting. Combine the two.

**PartyVote** (Sprague et al., 2008). Minimal-commitment voting + visual social-awareness cues to enforce fairness via peer pressure rather than algorithm. **Lesson:** A live face-or-avatar grid showing "everyone has voted" is itself a fairness mechanism. Make non-voting socially visible.

**Spotify AI DJ (2023).** Single-user, but the "AI host with commentary" model is relevant: Spotify found that *narration around the music* (why it picked this, what's next) dramatically increased perceived personalisation. **Lesson:** When you present the three teacher suggestions, narrate them — "Three students voted melancholy + low-energy and one seeded Phoebe Bridgers. Suggestion 1 leans into that mood; Suggestion 2 picks up energy; Suggestion 3 is a wildcard from someone's chill-out vote." Narration = perceived fairness.

**Hangout (2024 turntable revival).** Worth watching, but ships post-pilot — no production lessons yet. Their stated bet is "identifiable DJ avatars + gamification" which validates the identification-not-anonymity lesson.

---

## A. Cross-system synthesis — what repeats

**Patterns that worked across systems:**
1. **Weighted random selection with recency penalty** (MusicFX, GroupFun). Beats deterministic max-vote-wins on both fairness *and* perceived variety.
2. **Time/turn-based rotation as a fairness backstop** (plug.dj, turntable.fm). Even if the algorithm is fair, the group's *perception* of fairness depends on "did I get a turn lately?"
3. **Identifiable contribution** (plug.dj DJs, turntable.fm stage, Hangout's pivot). People want credit for the good picks they made.
4. **Social-awareness visibility** (Jukola public display, PartyVote vote tally). The voting process itself is the social glue, not just the output.
5. **Minimal-commitment input** (PartyVote, Spotify Jam's tap-to-queue). Anything that requires explicit ratings of 91 genres is dead on arrival in a 60-second classroom round.

**Patterns that failed across systems:**
1. **Anonymous negative voting** (Spotify Jam griefing, JQBX downvote anxiety). Anonymity + negative signal = social rot.
2. **No isolation from individual taste models** (Spotify Blend "ruined my algorithm"). Group features must not pollute personal recommendation feedback loops.
3. **Static skip/win thresholds across group sizes** (JQBX's multi-year tuning saga). 3 students and 30 students need different math.
4. **Bot/power-user moderation creep** (plug.dj, turntable.fm). Whoever runs the rooms wins; ordinary users churn.
5. **Stale refresh** (Spotify Blend). Repeat-use products die if the output stabilises.
6. **Royalty/licensing economics for ad-free social** (turntable.fm, plug.dj). Class DJ should never play full tracks itself — surface picks the *teacher* plays on their existing Spotify/YouTube. Don't be in the licensing path.

---

## B. What none of these systems solved — Class DJ's specific gaps

1. **The 60-second decision under instruction-time pressure.** Every prior system assumes voluntary, leisure-time engagement. Classroom = compulsory + clock-bounded. Students who don't vote in 60s must not block the system. **Default action for non-voters: their last term's average vote, or a neutral mid-mood/mid-energy.** No prior system handles this.
2. **Teacher-as-final-gatekeeper (not host, not moderator).** Spotify Jam's "host" is in-group; the teacher is asymmetric authority. The teacher picks 1 of 3 — that human-in-the-loop step doesn't exist in any prior system and is *the* safety-and-pedagogy lever. Lean into it; don't try to automate it away.
3. **Persistent class memory across a term.** Blend's "stale" problem and turntable's "audience boredom" both come from no longitudinal model. Class DJ must remember: which student got picked last time? Which mood combinations have been overused? Which student hasn't had their seed-artist selected yet this month? **Build a per-class fairness ledger** — this is novel.
4. **School-safety constraint on output.** No prior system filtered for explicit lyrics, age-appropriate artists, or cultural sensitivities at the *suggestion* layer. Class DJ's three suggestions must already pass a safety filter so the teacher's pick is always safe.
5. **Tiny groups (3 students).** MusicFX deployed with ~30 gym members average. Spotify Blend caps at 10. JQBX needed a log-scale fix for small rooms. A 3-student class is *qualitatively different* — one student is 33% of the group. The algorithm needs explicit small-group mode (closer to least-misery — every voice matters) vs large-group mode (weighted random — variety matters).
6. **Repeat sessions with same group.** Prior systems are designed for one-night parties or transient gym presence. Class DJ runs the same room many times per term, which is closer to nothing in the literature — the closest analog is MusicFX's 5-year deployment, but with rotating gym attendance not a fixed cohort.

---

## C. One-line opinionated takeaway

**If you steal one idea from prior art, steal MusicFX's weighted-random-with-recency-penalty algorithm — not the deterministic majority-wins logic every newer product reaches for — and bolt on a per-class fairness ledger so "who hasn't been picked recently" weights into the next round.**

---

## Sources

**MusicFX:**
- [MusicFX: An Arbiter of Group Preferences (PDF)](https://www.cs.unm.edu/~dlchao/radio/MusicFX.pdf)
- [MusicFX at AAAI archives](https://aaai.org/papers/0015-ss98-02-015-musicfx-an-arbiter-of-group-preferences/)
- [MusicFX CSCW98 slides](https://www.slideshare.net/gumption/musicfx-cscw98)
- [MusicFX project page (Joe McCarthy)](https://interrelativity.com/joe/projects/MusicFX.html)

**Spotify Blend:**
- [A Look Behind Blend — Spotify Engineering](https://engineering.atspotify.com/2021/12/a-look-behind-blend-the-personalized-playlist-for-youand-you)
- [Spotify Blend: Designing for a Social Listening Experience](https://spotify.design/article/spotify-blend-designing-for-a-social-listening-experience)
- [Spotify Newsroom Blend announcement](https://newsroom.spotify.com/2021-08-31/how-spotifys-newest-personalized-experience-blend-creates-a-playlist-for-you-and-your-bestie/)
- [Spotify Community: How does Blend affect my algorithm](https://community.spotify.com/t5/Content-Questions/How-does-Spotify-Blend-affect-my-own-algorithm/td-p/5502631)
- [Spotify Community: Blend not updating](https://community.spotify.com/t5/Content-Questions/Blend-playlist-is-not-updated/td-p/5263933)

**Spotify Jam:**
- ["Play my damn song!" — Nathalie Van Raemdonck case study (2024)](https://nathalievanraemdonck.com/2024/01/02/play-my-damn-song-social-norm-conflict-over-spotifys-jam-feature/)
- [Spotify Newsroom Jam announcement](https://newsroom.spotify.com/2023-09-26/spotify-jam-personalized-collaborative-listening-session-free-premium-users/)
- [Spotify Community: General Jam Issues](https://community.spotify.com/t5/Other-Podcasts-Partners-etc/General-Jam-Issues/td-p/6156646)

**plug.dj:**
- [The perils of a young audience: why plug.dj died — Radio Survivor](https://www.radiosurvivor.com/2015/09/the-perils-of-a-young-audience-why-plug-dj-died/)
- [plug.dj — Wikipedia](https://en.wikipedia.org/wiki/Plug.dj)
- [Turntable.fm Clone Plug.dj — Tiny Mix Tapes](https://www.tinymixtapes.com/news/plugdj-turntablefm-clone-shuts-down)

**turntable.fm:**
- [Turntable.fm — Wikipedia](https://en.wikipedia.org/wiki/Turntable.fm)
- [What Happened to Turntable.fm — Failory](https://www.failory.com/cemetery/turntable-fm)
- [Bring Back Turntable.fm — Vice](https://www.vice.com/en/article/pkyepn/bring-back-turntablefm)
- [Turntable returns as Hangout — Hypebot (2024)](https://www.hypebot.com/hypebot/2024/08/turntable-returns-as-hangout.html)
- [Roll over Boothoven! Turntable.fm's bot revolution — Radio Survivor](https://www.radiosurvivor.com/2012/08/meet-boothoven-inside-turntable-fms-bot-revolution/)

**JQBX:**
- [JQBX issue #127: Downvoting in large rooms doesn't skip](https://github.com/JasonZigelbaum/jqbx-issues/issues/127)
- [JQBX issue #199: Rework/Disable down-vote button](https://github.com/JasonZigelbaum/jqbx-issues/issues/199)
- [JQBX guide](https://www.jqbx.fm/guide)

**GroupFun:**
- [Designing a Voting Mechanism in GroupFun (Springer)](https://link.springer.com/chapter/10.1007/978-3-642-39476-8_78)
- [Group Recommender Systems as a Voting Problem](https://www.researchgate.net/publication/228842504_Group_Recommender_Systems_as_a_Voting_Problem)

**Other systems:**
- [Jukola: Democratic Music Choice in a Public Space (PDF, Microsoft Research)](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/Jukola_DIS.pdf)
- [Music selection using the PartyVote democratic jukebox](https://www.researchgate.net/publication/220944867_Music_selection_using_the_PartyVote_democratic_jukebox)
- [Flytrap: Intelligent group music recommendation](https://www.researchgate.net/publication/221608233_Flytrap_Intelligent_group_music_recommendation)
- [Spotify AI DJ announcement](https://newsroom.spotify.com/2023-02-22/spotify-debuts-a-new-ai-dj-right-in-your-pocket/)

**Survey / synthesis:**
- [Group Recommender Systems: Aggregation, Satisfaction and Group Attributes (Masthoff, Springer)](https://link.springer.com/chapter/10.1007/978-1-4899-7637-6_22)
- [Sequential group recommendations based on satisfaction and disagreement scores](https://link.springer.com/article/10.1007/s10844-021-00652-x)
- [An introduction to group recommender systems — Towards Data Science](https://towardsdatascience.com/an-introduction-to-group-recommender-systems-8f942a06db56/)
