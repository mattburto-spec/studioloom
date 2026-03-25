// Quest Health Score Computation
// Pure functions — takes data in, returns health assessment

import type { HealthLevel, HealthScore, QuestJourney, QuestMilestone, QuestEvidence } from './types';

export interface HealthInput {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  recentEvidence: QuestEvidence[];   // last 7 days
  daysSinceLastEvidence: number;
  daysSinceLastAIInteraction: number;
  selfReportedPulse: 'crushing_it' | 'okay' | 'stuck' | 'lost' | null;
}

/** Compute momentum: are milestones being completed on time? */
function computeMomentum(milestones: QuestMilestone[]): HealthLevel {
  const active = milestones.filter(m => m.status === 'active' || m.status === 'overdue');
  const overdue = active.filter(m => {
    if (!m.target_date) return false;
    return new Date(m.target_date) < new Date();
  });

  if (overdue.length === 0) return 'green';
  if (overdue.length <= 1) return 'amber';
  return 'red';
}

/** Compute engagement: is the student actively producing evidence? */
function computeEngagement(input: HealthInput): HealthLevel {
  if (input.daysSinceLastEvidence <= 2) return 'green';
  if (input.daysSinceLastEvidence <= 5) return 'amber';
  return 'red';
}

/** Compute quality: is work getting more complex over time? */
function computeQuality(recentEvidence: QuestEvidence[]): HealthLevel {
  const analysed = recentEvidence.filter(e => e.ai_analysis?.complexity_score != null);
  if (analysed.length < 2) return 'green'; // not enough data

  const scores = analysed.map(e => e.ai_analysis!.complexity_score);
  const midpoint = Math.floor(scores.length / 2);
  const firstHalf = scores.slice(0, midpoint);
  const secondHalf = scores.slice(midpoint);

  if (firstHalf.length === 0 || secondHalf.length === 0) return 'green';

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (avgSecond >= avgFirst) return 'green';
  if (avgSecond >= avgFirst * 0.8) return 'amber';
  return 'red';
}

/** Compute self-awareness: does self-report match reality? */
function computeSelfAwareness(input: HealthInput): HealthLevel {
  if (!input.selfReportedPulse) return 'green';

  const momentum = computeMomentum(input.milestones);
  const engagement = computeEngagement(input);
  const hasRed = momentum === 'red' || engagement === 'red';
  const allGreen = momentum === 'green' && engagement === 'green';

  // Over-confident: says crushing it but actually struggling
  if (input.selfReportedPulse === 'crushing_it' && hasRed) return 'red';
  if (input.selfReportedPulse === 'okay' && hasRed) return 'amber';
  // Under-confident: says stuck but actually on track
  if ((input.selfReportedPulse === 'stuck' || input.selfReportedPulse === 'lost') && allGreen) return 'amber';

  return 'green';
}

/** Compute check-in interval based on health (minutes) */
function computeCheckInInterval(score: Pick<HealthScore, 'momentum' | 'engagement' | 'quality' | 'self_awareness'>): number {
  const levels = [score.momentum, score.engagement, score.quality, score.self_awareness];
  const redCount = levels.filter(l => l === 'red').length;
  const amberCount = levels.filter(l => l === 'amber').length;

  if (redCount >= 2) return 5;
  if (redCount >= 1) return 10;
  if (amberCount >= 2) return 10;
  if (amberCount >= 1) return 15;
  return 25; // all green — light touch
}

/** Main health score computation */
export function computeHealthScore(input: HealthInput): HealthScore {
  const momentum = computeMomentum(input.milestones);
  const engagement = computeEngagement(input);
  const quality = computeQuality(input.recentEvidence);
  const self_awareness = computeSelfAwareness(input);

  const partial = { momentum, engagement, quality, self_awareness };
  return {
    ...partial,
    last_computed_at: new Date().toISOString(),
    check_in_interval_minutes: computeCheckInInterval(partial),
  };
}

/** Get a human-readable health summary for student display */
export function getHealthSummary(score: HealthScore): string {
  const levels = [score.momentum, score.engagement, score.quality, score.self_awareness];
  const redCount = levels.filter(l => l === 'red').length;
  const amberCount = levels.filter(l => l === 'amber').length;

  if (redCount >= 2) return "Let's get back on track — your mentor is here to help.";
  if (redCount >= 1) return 'One area needs attention — check your milestones.';
  if (amberCount >= 2) return "Steady progress — a few things to keep an eye on.";
  if (amberCount >= 1) return "Looking good — just one small thing to watch.";
  return "You're on a roll! Keep up the momentum.";
}

/** Get health level color for UI */
export function getHealthColor(level: HealthLevel): string {
  switch (level) {
    case 'green': return '#10B981';
    case 'amber': return '#F59E0B';
    case 'red': return '#EF4444';
  }
}
