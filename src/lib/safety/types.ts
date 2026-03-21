export interface LearnCard {
  title: string;
  content: string;
  icon: string; // emoji or icon name
}

export interface BadgeQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'scenario' | 'sequence' | 'match';
  topic: string;
  prompt: string;
  image_description?: string;
  options?: string[];
  match_pairs?: Array<{ left: string; right: string }>; // for match type
  correct_answer: string | string[] | number[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface BadgeDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: 'safety' | 'skill' | 'software';
  tier: number;
  color: string;
  icon_name: string;
  is_built_in: boolean;
  pass_threshold: number;
  expiry_months: number;
  retake_cooldown_minutes: number;
  question_count: number;
  topics: string[];
  learn_content: LearnCard[];
  question_pool: BadgeQuestion[];
}

export interface BadgeResult {
  badge_id: string;
  score: number;
  passed: boolean;
  answers: Array<{
    question_id: string;
    selected: string | string[] | number[];
    correct: boolean;
    time_ms: number;
  }>;
  time_taken_seconds: number;
}

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  badge?: BadgeDefinition;
  awarded_at: string;
  expires_at: string | null;
  score: number | null;
  status: 'active' | 'expired' | 'revoked';
}
