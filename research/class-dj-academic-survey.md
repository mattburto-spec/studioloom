# Class DJ — Academic Survey on Group Preference Aggregation

**Audience:** developer implementing a 60-second classroom music-voting feature. Undergrad social-choice background assumed. The question this survey answers: *which literatures are load-bearing for this build, what do they actually say, and what should you ship?*

---

## 1. State-of-the-art summary

The problem Class DJ poses — ephemeral group, low-bandwidth ballots, time-pressured aggregation, a soft objective ("the room can live with it"), hard vetoes, and repeated rounds with accumulating memory — sits at the intersection of four mature literatures and one emerging one.

**Group Recommender Systems (GRS)** is the canonical home. Founding work is Judith Masthoff's "Group Modeling: Selecting a Sequence of Television Items to Suit a Group of Viewers" (*User Modeling and User-Adapted Interaction* 14, pp. 37–85, 2004), which empirically catalogued the eleven aggregation strategies Class DJ effectively has to choose between: Average / Additive Utilitarian, Average Without Misery, Least Misery, Most Pleasure, Plurality Voting, Approval Voting, Borda, Copeland, Fairness, Most Respected Person, and Multiplicative. Masthoff's follow-up chapter "Group Recommender Systems: Combining Individual Models" (in Ricci et al., *Recommender Systems Handbook*, 1st ed. 2011 and updated through the 3rd ed. 2022 chapter "Group Recommender Systems: Beyond Preference Aggregation," Springer) is the right single reading. The MUSICFX system (McCarthy & Anagnost, 1998, *CSCW '98*) is the direct ancestor — a gym-radio arbiter that took member preferences and selected a station in real time using a weighted sum with a "minimize-misery" tie-breaker. It is genealogically the closest production system to Class DJ.

**Social choice theory** supplies the voting primitives (Borda, Approval, Plurality, Range) and the bad news: Gibbard (1973) and Satterthwaite (1975) showed every non-dictatorial ranked voting rule over ≥3 options is manipulable; Moulin (1988) showed Condorcet-consistent rules with ≥4 candidates fail the participation axiom (the *no-show paradox*). Brams & Fishburn's *Approval Voting* (Birkhäuser, 1983; reissued Springer 2007) remains the standard reference for approval ballots; their work shows approval is the only system that elects a Condorcet winner under sincere voting while letting voters express thresholds rather than rankings. For multi-winner extensions (relevant because Class DJ outputs *three* suggestions, not one), see Lackner & Skowron, *Multi-Winner Voting with Approval Preferences* (Springer SpringerBriefs, 2023). **Multi-Criteria Decision Analysis (MCDA)** — TOPSIS (Hwang & Yoon, 1981), ELECTRE (Roy, 1968), PROMETHEE (Brans, 1982) — frames Class DJ's mood/energy/veto/seed as orthogonal axes to be combined under explicit weights and ideal-point geometry. Madanchian & Taherdoost, "A Comprehensive Guide to the TOPSIS Method" (SSRN, 2023) is a current overview. **Conflict-aware GRS** is the live frontier: Stratigi, Nummenmaa et al., "Sequential group recommendations based on satisfaction and disagreement scores" (*Journal of Intelligent Information Systems*, 2021); Quintarelli et al., "Performance Evaluation of Aggregation-based Group Recommender Systems for Ephemeral Groups" (*ACM TIST*, 2022); the ADAPT framework (Vlachou et al., *Information Systems*, 2025); and Felfernig et al.'s *Group Recommender Systems: An Introduction* (Springer, 2018, 2nd ed. 2024) which devotes a chapter to consensus building and explanations. For the *opinion-clustering* angle — surfacing factions rather than averaging them away — the canonical reference is **Small, Bjorkegren, Erkkilä, Shaw & Megill, "Polis: Scaling deliberation by mapping high dimensional opinion spaces"** (*RECERCA: Revista de Pensament i Anàlisi*, vol. 26 no. 2, 2021), with a contemporary update in Maene, Megill et al., "Bridging Voting and Deliberation with Algorithms: Field Insights from vTaiwan and Kultur Komitee" (*ACM FAccT 2025*, arXiv:2502.05017). Pol.is uses PCA on the user-by-statement vote matrix, then k-means (k chosen by silhouette, capped at 5), to surface opinion groups; "group-informed consensus" then re-ranks statements by support *across* clusters rather than overall.

For **time-bounded / single-shot elicitation**, the relevant strand is the Doodle-poll literature: Zou, Meir & Parkes, "Strategic Voting Behavior in Doodle Polls" (*CSCW 2015*) shows that even in a friendly, low-stakes approval setting, ~half of voters strategically misreport availability — directly relevant to the "fun" chip being over-voted. Obraztsova et al., "Doodle Poll Games" (*AAMAS 2017*) formalizes the equilibria. On music-specific multi-objective aggregation, Mehrotra et al., "Mostra: Balancing multiple objectives for music recommendation" (Spotify Research, *WWW 2022*) and Vargas et al., "A Multi-Objective Music Recommendation Approach for Aspect-Based Diversification" (*ISMIR 2017*) are the standards.

---

## 2. Technique-by-technique fit assessment

**Average / Additive Utilitarian.** Sum (or mean) every student's score for each candidate song. Shines when preferences are roughly unimodal; produces high *mean* satisfaction. Fails Class DJ's "room can live with it" test exactly because it averages a split room into a tepid middle: 15 students wanting energy-4 build music and 15 wanting energy-1 focus music yield "energy-2.5 anything," which nobody asked for. Stratigi et al. (2021) document this on MovieLens: Average has the best satisfaction score but mediocre disagreement.

**Least Misery.** Score each candidate by its worst individual rating; pick the max-min. Shines for honoring vetoes — it *is* the formal model of "one student vetos, song dies." Fails as the sole aggregator: a single grumpy student can collapse the entire candidate set, especially in a 30-student class where someone will hate any specific song. Best used as a **filter** (apply vetoes; eliminate sub-threshold options) layered over a different positive aggregator, not as the picker itself. Masthoff (2004) explicitly recommends this hybrid pattern.

**Average Without Misery.** Mean rating, but drop any candidate whose minimum is below threshold δ. This is, in my read, the strongest single match for Class DJ's brief: it operationalizes "room can live with it" (δ = minimum acceptable) while picking by group-mean utility. Masthoff's user studies found subjects rated AWM-generated sequences highest. The implementation cost is one extra pass over the candidate matrix.

**Approval voting.** Each chip a student picks is an approval ballot over moods; energy 1–5 can be transformed into approvals over energy-bands. Shines for low-bandwidth UX (a tap is an approval) and is strategy-resistant at the *equilibrium* level — Brams & Fishburn 1983 prove it elects the Condorcet winner under sincere voting. Fails when you need ranking granularity (which Class DJ does *not* need). Direct fit for the mood chips.

**Borda.** Asks for full rankings. Class DJ doesn't have rankings to give — students tap one mood chip and one energy. Borda is a poor fit unless you re-engineer the UX, and even then it's manipulable (burying) and violates majority. Skip.

**Pareto-front selection.** Instead of collapsing axes to a scalar, return the *non-dominated set* across the (mood-match, energy-match, veto-clear, novelty) axes; let the teacher pick from the front. Shines for transparency — every output is justifiable as "no candidate beats this one on every axis." Xiao et al., "Fairness-Aware Group Recommendation with Pareto-Efficiency" (*RecSys 2017*) is the proof point. Excellent fit because Class DJ already promises "3 suggestions a teacher picks from" — that's a Pareto front by another name. The catch: the front can be too large or too small depending on how correlated the axes are; you may need a secondary tiebreak (group-mean utility, or "respect the underdog" — see §4).

**TOPSIS (MCDA).** Frame Class DJ as: for each candidate song, compute distance from an ideal point (max mood-match, max veto-clearance, energy-fit) and an anti-ideal point (the room's collective miseries); rank by closeness coefficient. Shines for the mixed-criteria nature of the input (categorical mood, ordinal energy, hard veto, free-text seed) — TOPSIS handles heterogeneous criteria natively under explicit weights. Fails on transparency to a teacher ("the closeness coefficient says…") and on weight calibration (who decides mood is worth more than energy?). A workable middle ground: use TOPSIS *inside* the candidate scoring step and Pareto-front *across* the final three outputs.

**Cluster-then-suggest-per-cluster (Pol.is pattern).** Run PCA + k-means on the (student × chip-vote) matrix. If two distinct factions emerge, the three outputs are: (a) the cross-cluster bridge song (high approval in *all* clusters), (b) cluster-1's favourite, (c) cluster-2's favourite. Shines exactly on Class DJ's split-room failure mode (§3 below). Fails on tiny classes (k-means is unstable below n≈8) and adds latency, though well under the 5-second budget at 30 students × ~5 features. Cold-start friendly: doesn't need history. Strong fit; arguably the differentiator.

---

## 3. The split-room problem

This is exactly what Pol.is was built to surface and what Average fails. The relevant prescription is in two layers:

**Detection.** Compute a disagreement metric on the votes. Stratigi et al. (2021) define group disagreement on item *i* as the variance (or pairwise mean absolute deviation) of individual satisfaction scores. Amer-Yahia et al., "Group Recommendation: Semantics and Efficiency" (*VLDB 2009*) introduced the *consensus function* — a weighted combination of relevance and disagreement — that lets you trade off the two explicitly. In practice for Class DJ: if the energy-vote vector has a bimodality coefficient > 0.555 (Pearson's rule of thumb) or the silhouette of a k=2 cluster on (mood-onehot, energy) exceeds ~0.5, treat the room as split.

**Response.** Three options the literature endorses:
1. **Surface, don't average** — explicitly show the teacher "the room is split into a 'focus' faction and a 'build' faction" and offer one song *per faction* + one bridge song. This is the vTaiwan move (Maene et al., *FAccT 2025*) and is Class DJ's natural extension because the output is already a set of three.
2. **Bridge-song scoring** — Pol.is's "group-informed consensus" ranks statements by *minimum across-cluster approval*, not overall approval. Apply to song candidates: rank by `min(approval_in_cluster_A, approval_in_cluster_B)`. This formally rewards the "everyone can live with it" candidate over the "polarising-but-loved-by-majority" one.
3. **Sequential rotation** — if the same room splits the same way every class, alternate which cluster wins each round (Masthoff's "fairness" strategy; ADAPT framework, Vlachou et al. 2025). Requires class memory but Class DJ already commits to that.

Do *not* average a bimodal distribution. That is the canonical failure documented across every paper cited in this section.

---

## 4. Fairness over time

The relevant pattern Masthoff named "Most Respected Person" — always defer to whoever the system thinks matters most — is the anti-pattern Class DJ explicitly wants to avoid. Three lightweight techniques from the literature, none of which require per-student profiles:

**Satisfaction balancing across rounds (Stratigi et al., 2021; ADAPT 2025).** Track a running per-student satisfaction score = exponential moving average of how well their vote aligned with the chosen output. On each round, weight student votes inversely to their cumulative satisfaction. The student who "lost" three rounds in a row gets a louder vote on round four. No identity profile needed — just an opaque per-seat counter. ADAPT's "FaDJO" and "DiGSFO" aggregators (Vlachou et al., *Information Systems* 2025) are direct implementations.

**Round-robin cluster wins.** If the same factions keep emerging, rotate which faction's preference dominates the bridge tiebreak. Stratigi et al. show this materially closes the disagreement gap without harming mean satisfaction.

**Plurality-with-decay.** If "fun" wins every Friday, decay its weight on subsequent Fridays. This is the multi-armed-bandit / contextual-decay trick (Vargas et al. *ISMIR 2017* apply it to music aspect diversification). Cheap and explainable: "we played upbeat last time, so this time we biased toward focus."

The combination — per-seat fairness EMA + cluster rotation — gives you provable bounded unfairness (no student can lose more than k consecutive rounds before their effective weight crosses any other student's) without touching student identity. That's the sweet spot for a classroom tool.

---

## 5. Cold-start in GRS

First-round behaviour with zero class history. The literature converges on three rules:

1. **Lean on aggregation, not collaborative filtering.** Quintarelli et al. (*ACM TIST 2022*) benchmark aggregation-based GRS specifically on ephemeral groups and find that for groups with no history, simple aggregation (AWM, Approval, Plurality) consistently beats model-based methods that need a warm-up — because model-based methods *don't have one*. Class DJ is fundamentally ephemeral.
2. **Use a content-based seed, not a CF seed.** Salehi-Abari & Boutilier, "Preference-oriented Social Networks: Group Recommendation and Inference" (*RecSys 2014*) and the survey by Dara et al., "A survey on group recommender systems" (*Journal of Intelligent Information Systems*, 2020) both note that audio-feature similarity (Spotify's audio embeddings or equivalent) reliably substitutes for class history on round one.
3. **Treat round one as exploration.** Mehrotra et al. (Spotify *WWW 2022*) explicitly use a higher diversity weight on cold sessions, then anneal it. For Class DJ this means: round one ships three *diverse* outputs (different moods, different energies); class memory accumulates from round two onward.

Practically: round one runs (Approval on mood) × (median energy) × (Least-Misery veto filter) × (MMR diversification across the top-N), and there is nothing in the literature suggesting this is materially worse than a fully personalised system would be at n=1.

---

## 6. Failure-mode catalogue (and which apply)

Drawn from social-choice and GRS:

- **Strategic voting / manipulation** (Gibbard 1973; Satterthwaite 1975). *Applies.* The "fun" chip will be over-voted Friday afternoon. Approval is robust *at equilibrium* but Zou-Meir-Parkes (CSCW 2015) show ~50% of real-world approval voters misreport in Doodle polls. Mitigation: hide the running tally during the 60-second window.
- **Tyranny of the majority / minority overrule.** *Applies.* Pure Average + Plurality erases the focus minority. Mitigation: AWM + cluster surfacing.
- **No-show paradox** (Moulin 1988). *Applies weakly.* Students who abstain may improve their own outcome compared to voting honestly. Approval voting satisfies participation, so use approval, not Condorcet.
- **Condorcet cycles.** *Applies marginally.* Three-way rock-paper-scissors among mood chips is possible with five chips and 30 voters, but resolvable via Borda-on-approval or simple plurality tiebreak. Don't lose sleep.
- **Sparse-input collapse.** *Applies strongly.* If only 4 of 30 students vote, every aggregator becomes noisy. Mitigation: require a minimum participation threshold (e.g., 50%) before serving outputs; otherwise fall back to teacher-default mood.
- **"Most Respected Person" entrenchment.** *Applies.* Addressed in §4.
- **Recommendation drift / popularity collapse.** *Applies.* Once a song gets picked, the class memory may keep selecting near-duplicates. Mitigation: MMR-style intra-list distance (Carbonell & Goldstein, *SIGIR 1998*) at the output stage.
- **Veto-as-attack.** *Applies.* A free-text veto field is a vector for "I veto all music." Mitigation: cap vetoes per student (literature default is one), require text (not blank), and rate-limit veto adoption across rounds.

---

## 7. Bottom line

**If you implement nothing else, do this: Average-Without-Misery (with the veto field as the misery threshold) for the scalar score, k-means k≤2 on the vote matrix to detect a split room, and a Pareto-front-then-MMR selector to return three diverse non-dominated suggestions — with a per-seat satisfaction EMA carried across rounds for fairness.** Skip Borda (no rankings to give), skip pure Average (averages a split room away), skip CF-based GRS (cold-start is permanent in your setting). The Masthoff (2004) + Stratigi (2021) + Pol.is (Small et al. 2021) triangle is the entire conceptual stack you need; everything else is tuning.

---

## Sources cited (chronological where it matters)

- Gibbard, A. (1973). "Manipulation of Voting Schemes: A General Result." *Econometrica* 41(4).
- Satterthwaite, M. (1975). "Strategy-proofness and Arrow's conditions." *Journal of Economic Theory* 10.
- Carbonell, J. & Goldstein, J. (1998). "The use of MMR, diversity-based reranking for reordering documents and producing summaries." *SIGIR '98*.
- McCarthy, J.F. & Anagnost, T.D. (1998). "MUSICFX: An Arbiter of Group Preferences for Computer Supported Collaborative Workouts." *CSCW '98*.
- Brams, S.J. & Fishburn, P.C. (1983, reissued 2007). *Approval Voting*. Springer.
- Hwang, C.L. & Yoon, K. (1981). *Multiple Attribute Decision Making: Methods and Applications*. Springer (TOPSIS).
- Moulin, H. (1988). "Condorcet's principle implies the no show paradox." *Journal of Economic Theory* 45.
- Masthoff, J. (2004). "Group Modeling: Selecting a Sequence of Television Items to Suit a Group of Viewers." *UMUAI* 14, 37–85.
- Amer-Yahia, S., Roy, S.B., Chawla, A., Das, G., & Yu, C. (2009). "Group Recommendation: Semantics and Efficiency." *VLDB 2009*.
- Masthoff, J. (2011, updated 2022). "Group Recommender Systems: Combining Individual Models" / "...Beyond Preference Aggregation." In Ricci et al. (eds.), *Recommender Systems Handbook* (1st, 2nd, 3rd eds.). Springer.
- Salehi-Abari, A. & Boutilier, C. (2014). "Preference-oriented Social Networks." *RecSys 2014*.
- Zou, J., Meir, R. & Parkes, D. (2015). "Strategic Voting Behavior in Doodle Polls." *CSCW 2015*.
- Vargas, S., et al. (2017). "A Multi-Objective Music Recommendation Approach for Aspect-Based Diversification." *ISMIR 2017*.
- Xiao, L., et al. (2017). "Fairness-Aware Group Recommendation with Pareto-Efficiency." *RecSys 2017*.
- Felfernig, A., Boratto, L., Stettinger, M. & Tkalčič, M. (2018, 2nd ed. 2024). *Group Recommender Systems: An Introduction*. Springer.
- Dara, S., et al. (2020). "A survey on group recommender systems." *Journal of Intelligent Information Systems*.
- Stratigi, M., Nummenmaa, A., et al. (2021). "Sequential group recommendations based on satisfaction and disagreement scores." *Journal of Intelligent Information Systems*.
- Small, C., Bjorkegren, M., Erkkilä, T., Shaw, L. & Megill, C. (2021). "Polis: Scaling deliberation by mapping high dimensional opinion spaces." *RECERCA* 26(2).
- Quintarelli, E., Rabosio, E. & Tanca, L. (2022). "Performance Evaluation of Aggregation-based Group Recommender Systems for Ephemeral Groups." *ACM TIST*.
- Mehrotra, R., et al. (2022). "Mostra: Balancing multiple objectives for music recommendation." Spotify Research / *WWW 2022*.
- Lackner, M. & Skowron, P. (2023). *Multi-Winner Voting with Approval Preferences*. Springer Briefs.
- Felfernig, A., et al. (2023). "An overview of consensus models for group decision-making and group recommender systems." *UMUAI*.
- Vlachou, A., et al. (2025). "ADAPT: Fairness & diversity for sequential group recommendations." *Information Systems*.
- Maene, V., Megill, C., et al. (2025). "Bridging Voting and Deliberation with Algorithms: Field Insights from vTaiwan and Kultur Komitee." *ACM FAccT 2025* (arXiv:2502.05017).

**Could not locate a definitive source for:** the "Anwar/Mantel-style" opinion clustering line referenced in the brief. Closest match found is the Pol.is Small et al. (2021) paper plus the broader clustering-based GRS survey (Bobadilla et al., arXiv:2109.12839). If "Anwar/Mantel" refers to a specific paper, please send the citation — it may sit under different author names in the indices I searched.
