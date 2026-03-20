/**
 * TeachingDNA Component Stories
 *
 * Example usage and mock data for the Teaching DNA visualization.
 * Use these examples to see how the component responds to different profile states.
 */

import { TeachingDNA } from './TeachingDNA';
import { type TeacherStyleProfile } from '@/types/teacher-style';

/**
 * MOCK DATA: Cold start (no data yet)
 */
const mockColdStart: TeacherStyleProfile = {
  teacherId: 'teacher-001',
  lessonPatterns: {
    typicalPhaseSequence: [],
    averageTheoryPracticalRatio: 0.4,
    averageLessonLength: 50,
    preferredActivityTypes: [],
    uploadCount: 0,
  },
  editPatterns: {
    frequentlyDeletedSections: [],
    frequentlyAddedElements: [],
    averageTimingAdjustment: 0,
    editCount: 0,
  },
  resourcePreferences: {
    topUploadCategories: [],
    referencedFrameworks: [],
  },
  gradingStyle: {
    averageStrictness: 0.5,
    criterionEmphasis: {},
    feedbackLength: 'moderate',
    gradingSessionCount: 0,
  },
  confidenceLevel: 'cold_start',
  totalUnitsCreated: 0,
  totalLessonsEdited: 0,
  lastUpdated: new Date().toISOString(),
};

/**
 * MOCK DATA: Learning phase (some data accumulated)
 */
const mockLearning: TeacherStyleProfile = {
  teacherId: 'teacher-002',
  lessonPatterns: {
    typicalPhaseSequence: ['intro', 'making', 'workshop'],
    averageTheoryPracticalRatio: 0.35,
    averageLessonLength: 48,
    preferredActivityTypes: [
      { type: 'making', frequency: 5 },
      { type: 'workshop', frequency: 4 },
      { type: 'presentation', frequency: 3 },
      { type: 'critique', frequency: 3 },
      { type: 'research', frequency: 2 },
    ],
    uploadCount: 8,
  },
  editPatterns: {
    frequentlyDeletedSections: ['vocabulary warm-up', 'extension challenge'],
    frequentlyAddedElements: ['gallery walk', 'peer feedback'],
    averageTimingAdjustment: -4.2,
    editCount: 7,
  },
  resourcePreferences: {
    topUploadCategories: ['lesson plan', 'rubric'],
    referencedFrameworks: ['IB MYP'],
  },
  gradingStyle: {
    averageStrictness: 0.6,
    criterionEmphasis: { 'Technical Proficiency': 0.8, 'Design Thinking': 0.9 },
    feedbackLength: 'detailed',
    gradingSessionCount: 4,
  },
  confidenceLevel: 'learning',
  totalUnitsCreated: 5,
  totalLessonsEdited: 7,
  lastUpdated: new Date().toISOString(),
};

/**
 * MOCK DATA: Established (full profile)
 * This profile is a "Workshop Mentor" archetype
 */
const mockEstablishedMaker: TeacherStyleProfile = {
  teacherId: 'teacher-003',
  lessonPatterns: {
    typicalPhaseSequence: ['brief', 'making', 'workshop', 'gallery walk'],
    averageTheoryPracticalRatio: 0.25, // 25% theory, 75% practical
    averageLessonLength: 52,
    preferredActivityTypes: [
      { type: 'making', frequency: 12 },
      { type: 'workshop', frequency: 10 },
      { type: 'gallery walk', frequency: 9 },
      { type: 'critique', frequency: 8 },
      { type: 'peer review', frequency: 6 },
      { type: 'prototyping', frequency: 5 },
    ],
    uploadCount: 23,
  },
  editPatterns: {
    frequentlyDeletedSections: ['vocabulary warm-up', 'guided worksheet', 'sentence starter'],
    frequentlyAddedElements: ['gallery walk', 'peer feedback session', 'open challenge'],
    averageTimingAdjustment: -5.3,
    editCount: 20,
  },
  resourcePreferences: {
    topUploadCategories: ['lesson plan', 'rubric', 'exemplar work'],
    referencedFrameworks: ['IB MYP', 'ACARA'],
  },
  gradingStyle: {
    averageStrictness: 0.7,
    criterionEmphasis: {
      'Technical Proficiency': 0.75,
      'Design Thinking': 0.9,
      'Collaboration': 0.85,
    },
    feedbackLength: 'detailed',
    gradingSessionCount: 15,
  },
  confidenceLevel: 'established',
  totalUnitsCreated: 18,
  totalLessonsEdited: 20,
  lastUpdated: new Date().toISOString(),
};

/**
 * MOCK DATA: Established (full profile)
 * This profile is a "Studio Director" archetype (critique-heavy, student-led)
 */
const mockEstablishedStudioDirector: TeacherStyleProfile = {
  teacherId: 'teacher-004',
  lessonPatterns: {
    typicalPhaseSequence: ['discover', 'research', 'critique', 'iterate'],
    averageTheoryPracticalRatio: 0.45,
    averageLessonLength: 55,
    preferredActivityTypes: [
      { type: 'critique', frequency: 14 },
      { type: 'peer review', frequency: 12 },
      { type: 'research', frequency: 10 },
      { type: 'discussion', frequency: 9 },
      { type: 'presentation', frequency: 7 },
      { type: 'making', frequency: 5 },
    ],
    uploadCount: 21,
  },
  editPatterns: {
    frequentlyDeletedSections: ['direct instruction', 'step-by-step guide'],
    frequentlyAddedElements: ['critique prompt', 'reflection question', 'peer feedback'],
    averageTimingAdjustment: 2.1,
    editCount: 18,
  },
  resourcePreferences: {
    topUploadCategories: ['rubric', 'exemplar work', 'case study'],
    referencedFrameworks: ['IB MYP', 'A-Level DT'],
  },
  gradingStyle: {
    averageStrictness: 0.65,
    criterionEmphasis: {
      'Design Thinking': 0.95,
      'Communication': 0.9,
      'Collaboration': 0.88,
      'Technical Proficiency': 0.7,
    },
    feedbackLength: 'detailed',
    gradingSessionCount: 12,
  },
  confidenceLevel: 'established',
  totalUnitsCreated: 16,
  totalLessonsEdited: 18,
  lastUpdated: new Date().toISOString(),
};

/**
 * MOCK DATA: Established (full profile)
 * This profile is a "Digital Pioneer" archetype (CAD, digital tools, research)
 */
const mockEstablishedDigitalPioneer: TeacherStyleProfile = {
  teacherId: 'teacher-005',
  lessonPatterns: {
    typicalPhaseSequence: ['research', 'cad', 'prototype', 'testing'],
    averageTheoryPracticalRatio: 0.5,
    averageLessonLength: 58,
    preferredActivityTypes: [
      { type: 'CAD', frequency: 13 },
      { type: 'research', frequency: 11 },
      { type: 'digital prototyping', frequency: 10 },
      { type: 'analysis', frequency: 8 },
      { type: 'documentation', frequency: 7 },
      { type: 'technology exploration', frequency: 6 },
    ],
    uploadCount: 20,
  },
  editPatterns: {
    frequentlyDeletedSections: ['analogue sketching', 'hand-drawn worksheet'],
    frequentlyAddedElements: ['CAD task', 'digital research', 'spreadsheet analysis'],
    averageTimingAdjustment: 3.8,
    editCount: 16,
  },
  resourcePreferences: {
    topUploadCategories: ['case study', 'lesson plan', 'exemplar work'],
    referencedFrameworks: ['PLTW', 'A-Level DT'],
  },
  gradingStyle: {
    averageStrictness: 0.6,
    criterionEmphasis: {
      'Technical Proficiency': 0.95,
      'Design Thinking': 0.85,
      'Digital Skills': 0.9,
    },
    feedbackLength: 'moderate',
    gradingSessionCount: 11,
  },
  confidenceLevel: 'established',
  totalUnitsCreated: 14,
  totalLessonsEdited: 16,
  lastUpdated: new Date().toISOString(),
};

/**
 * Storybook exports
 */
export default {
  title: 'Teacher/TeachingDNA',
  component: TeachingDNA,
};

export const ColdStart = () => (
  <div className="p-6 bg-gray-50 min-h-screen">
    <TeachingDNA profile={mockColdStart} className="max-w-2xl" />
  </div>
);

export const Learning = () => (
  <div className="p-6 bg-gray-50 min-h-screen">
    <TeachingDNA profile={mockLearning} className="max-w-2xl" />
  </div>
);

export const EstablishedWorkshopMentor = () => (
  <div className="p-6 bg-gray-50 min-h-screen">
    <TeachingDNA profile={mockEstablishedMaker} className="max-w-2xl" />
  </div>
);

export const EstablishedStudioDirector = () => (
  <div className="p-6 bg-gray-50 min-h-screen">
    <TeachingDNA profile={mockEstablishedStudioDirector} className="max-w-2xl" />
  </div>
);

export const EstablishedDigitalPioneer = () => (
  <div className="p-6 bg-gray-50 min-h-screen">
    <TeachingDNA profile={mockEstablishedDigitalPioneer} className="max-w-2xl" />
  </div>
);

export const AllProfiles = () => (
  <div className="p-6 bg-gray-50 min-h-screen space-y-8">
    <div>
      <h2 className="text-2xl font-bold mb-4">Cold Start</h2>
      <TeachingDNA profile={mockColdStart} className="max-w-2xl" />
    </div>
    <div>
      <h2 className="text-2xl font-bold mb-4">Learning</h2>
      <TeachingDNA profile={mockLearning} className="max-w-2xl" />
    </div>
    <div>
      <h2 className="text-2xl font-bold mb-4">Workshop Mentor</h2>
      <TeachingDNA profile={mockEstablishedMaker} className="max-w-2xl" />
    </div>
    <div>
      <h2 className="text-2xl font-bold mb-4">Studio Director</h2>
      <TeachingDNA profile={mockEstablishedStudioDirector} className="max-w-2xl" />
    </div>
    <div>
      <h2 className="text-2xl font-bold mb-4">Digital Pioneer</h2>
      <TeachingDNA profile={mockEstablishedDigitalPioneer} className="max-w-2xl" />
    </div>
  </div>
);
