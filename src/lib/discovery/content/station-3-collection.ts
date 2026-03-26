/**
 * Station 3: The Collection Wall — Interests & Values
 *
 * Content: Interest icons (20), irritation scenarios (10),
 * YouTube rabbit hole topics (12), value cards (8).
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 3
 */

import type {
  InterestIcon,
  IrritationScenario,
  YouTubeTopic,
  ValueCard,
  AgeBand,
} from '../types';

// ─── Interest Icons (pick 5-7) ──────────────────────────────────

export const INTEREST_ICONS: InterestIcon[] = [
  { id: 'building', label: 'Building & making', icon: '🔨', cluster: 'Physical creation', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'art', label: 'Art & visual design', icon: '🎨', cluster: 'Creative expression', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'music', label: 'Music & sound', icon: '🎵', cluster: 'Creative expression', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'sports', label: 'Sports & movement', icon: '⚽', cluster: 'Physical', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'nature', label: 'Nature & environment', icon: '🌿', cluster: 'Environment', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'food', label: 'Food & cooking', icon: '🍳', cluster: 'Physical creation', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'coding', label: 'Coding & digital', icon: '💻', cluster: 'Technology', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'social_media', label: 'Social media & content', icon: '📱', cluster: 'Communication', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'photo_film', label: 'Photography & film', icon: '📷', cluster: 'Creative expression', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'gaming', label: 'Gaming & game design', icon: '🎮', cluster: 'Technology', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'reading', label: 'Reading & writing', icon: '📚', cluster: 'Communication', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'science', label: 'Science & experiments', icon: '🔬', cluster: 'Research', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'travel', label: 'Travel & cultures', icon: '✈️', cluster: 'Exploration', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'animals', label: 'Animals & wildlife', icon: '🐾', cluster: 'Environment', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'fashion', label: 'Fashion & textiles', icon: '👗', cluster: 'Creative expression', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'architecture', label: 'Architecture & spaces', icon: '🏗️', cluster: 'Systems', ageBands: ['junior', 'senior', 'extended'] },
  // Senior/Extended only
  { id: 'psychology', label: 'Psychology & people', icon: '🧠', cluster: 'Research', ageBands: ['senior', 'extended'] },
  { id: 'fairness', label: 'Fairness & justice', icon: '⚖️', cluster: 'Values', ageBands: ['senior', 'extended'] },
  { id: 'business', label: 'Business & entrepreneurship', icon: '💼', cluster: 'Systems', ageBands: ['senior', 'extended'] },
  { id: 'global', label: 'Global issues', icon: '🌍', cluster: 'Values', ageBands: ['junior', 'senior', 'extended'] },
  // Junior replacements
  { id: 'puzzles', label: 'Puzzles & problem-solving', icon: '🧩', cluster: 'Research', ageBands: ['junior'] },
  { id: 'performing', label: 'Performing & presenting', icon: '🎤', cluster: 'Communication', ageBands: ['junior'] },
  { id: 'robots', label: 'Robots & electronics', icon: '🤖', cluster: 'Technology', ageBands: ['junior'] },
];

// ─── Irritation Scenarios (pick 1-2 or write own) ───────────────

export const IRRITATION_SCENARIOS: IrritationScenario[] = [
  { id: 'bins', text: "When you can see the bin is full and people just keep piling rubbish on top instead of doing something about it", category: 'Environmental / Systems', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'bad_app', text: "When the school app is so confusing that it's faster to just ask someone in person", category: 'Design / Systems', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'no_voice', text: "When adults make decisions about you — your schedule, your groups, your options — without ever asking what you think", category: 'Autonomy / Leader', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'talked_over', text: "When someone has a good idea in a group but the loudest person talks over them and nobody notices", category: 'Social / Communicator', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'false_creative', text: "When you're told to 'be creative' but then every choice is already made for you", category: 'Autonomy / Creative', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'slow_simple', text: "When something that should take 2 minutes takes 20 because nobody thought about how people actually use it", category: 'Systems / Design', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'neglected_space', text: "When a space could be really nice but nobody cares enough to look after it", category: 'Environment / Creative', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'same_people', text: "When the same people always get picked for things and nobody else gets a chance", category: 'Fairness / Leader', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'status_quo', text: "When everyone knows something is a problem but people just shrug and say 'that's how it is'", category: 'Systems / Researcher', ageBands: ['senior', 'extended'] },
  { id: 'unfair_rules', text: "When rules exist to protect 'everyone' but actually only work for some people", category: 'Justice / Systems', ageBands: ['senior', 'extended'] },
];

// ─── YouTube Rabbit Hole Topics (select 2-3) ────────────────────

export const YOUTUBE_TOPICS: YouTubeTopic[] = [
  { id: 'factory', label: 'Factory tours / "How It\'s Made" stuff', icon: '🏭', cluster: 'Making / Systems', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'logo_design', label: 'Logo & design breakdowns', icon: '✏️', cluster: 'Creative / Research', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'diy', label: 'DIY builds / room makeovers / upcycling', icon: '🪚', cluster: 'Making / Creative', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'science_exp', label: 'Science experiments / "what happens if"', icon: '🧪', cluster: 'Research / Systems', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'street_interviews', label: 'Street interviews / social experiments', icon: '🎤', cluster: 'Communication / Research', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'gaming_design', label: 'Gaming content / game design deep dives', icon: '🎮', cluster: 'Technology / Creative', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'cooking', label: 'Cooking / recipe videos / food challenges', icon: '👨‍🍳', cluster: 'Making / Research', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'history', label: 'History rabbit holes / true stories / mysteries', icon: '📜', cluster: 'Research', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'fashion_vids', label: 'Fashion hauls / fit checks / textile stuff', icon: '👕', cluster: 'Creative', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'architecture_vids', label: 'Room tours / tiny homes / architecture', icon: '🏠', cluster: 'Creative / Systems', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'climate', label: 'Climate / sustainability / protest footage', icon: '🌱', cluster: 'Environment', ageBands: ['junior', 'senior', 'extended'] },
  { id: 'startup', label: 'Startup stories / "how I made money" / side hustles', icon: '🚀', cluster: 'Systems / Leader', ageBands: ['junior', 'senior', 'extended'] },
];

// ─── Value Cards (drag into Core / Important / Nice) ────────────

export const VALUE_CARDS: ValueCard[] = [
  { id: 'helping', label: 'Helping people', icon: '❤️', description: "You'd drop what you're doing if someone needed you — even if your own work suffers" },
  { id: 'beauty', label: 'Making things beautiful', icon: '✨', description: "You care whether things look right, feel right, are done with craft — even if nobody notices" },
  { id: 'fixing', label: "Fixing what's broken", icon: '🔧', description: "You see a problem and can't leave it alone — you have to solve it" },
  { id: 'originality', label: 'Doing it your way', icon: '🌟', description: "You'd rather do something original and imperfect than follow someone else's template" },
  { id: 'fairness', label: 'Making it fair', icon: '⚖️', description: "It bugs you when things are unfair — even when it doesn't affect you personally" },
  { id: 'understanding', label: 'Understanding deeply', icon: '🔬', description: "You'd rather know WHY something works than just know THAT it works" },
  { id: 'action', label: 'Making things happen', icon: '⚡', description: "You like being the person who gets people moving — even if it means making unpopular calls" },
  { id: 'belonging', label: 'Being part of something', icon: '🤝', description: "The best work you've done was with other people — the team matters as much as the result" },
];

// ─── Kit Dialogue ───────────────────────────────────────────────

export const STATION_3_KIT_DIALOGUE = {
  intro: "Now I want to see what you actually care about. Not what you think I want to hear — what you'd spend time on if nobody was grading you.",
  interest_prompt: "Tap the things that genuinely interest you. Not what looks good on a resume. What you actually spend time on.",
  interest_subtitle: "Pick 5-7",
  irritation_intro: "What do you actually watch when nobody's making you? The stuff you click at 11pm when you should be sleeping.",
  irritation_prompt: "Pick the one that makes you go 'YES, that.' Or write your own — that's even better.",
  irritation_freetext_prompt: "Write your own irritation — something that bugs you that wasn't on the list.",
  youtube_intro: "What do you actually watch when nobody's making you? The stuff you click at 11pm when you should be sleeping.",
  youtube_subtitle: "Pick 2-3",
  values_intro: "These are all good things. But you can't care about everything equally — nobody does. Drag them into what ACTUALLY drives you, not what sounds nicest.",
  values_tiers: { core: 'Core — this IS me', important: 'Important — I care about this', nice: 'Nice — but not what drives me' },
  reveal: "I can see what lights you up. That's important — because the best projects come from irritation plus interest. You've just shown me both.",
};
