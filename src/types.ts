export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  futureRequirements: string[];
}

export interface AttemptContent {
  assumptions: string;
  classesAndResponsibilities: string;
  relationships: string;
  extensibilityAnswer: string;
}

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'ABANDONED';

export interface Attempt {
  id: string;
  problemId: string;
  learnerId: string;
  status: AttemptStatus;
  content: AttemptContent;
  createdAt: string;
  updatedAt: string;
}

export type SubmissionStatus = 'SUBMITTED' | 'EVALUATING' | 'COMPLETED' | 'FAILED';

export interface Submission {
  id: string;
  attemptId: string;
  contentSnapshot: AttemptContent;
  status: SubmissionStatus;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
}

export interface CriterionResult {
  criterionKey: string;
  score: number; // 0 to 5
  evidence: string;
  concern: string;
  suggestion: string;
  confidence: number;
}

export interface Evaluation {
  id: string;
  submissionId: string;
  evaluatorType: 'DETERMINISTIC' | 'AI';
  rubricResults: CriterionResult[];
  overallSummary: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface Feedback {
  submissionId: string;
  deterministicEvaluation?: Evaluation;
  aiEvaluation?: Evaluation;
  combinedResults: CriterionResult[];
  overallSummary: string;
  aiAvailable: boolean;
  generatedAt: string;
}

export interface SubmissionResponse {
  submission: Submission;
  feedback: Feedback | null;
}

export interface HistoryItem {
  attempt: Attempt;
  problem: Problem | null;
  latestSubmission: Submission | null;
  evaluations: Evaluation[];
  feedback?: Feedback | null;
}

export interface ProblemHistoryResponse {
  problem: Problem;
  attempts: {
    attempt: Attempt;
    latestSubmission: Submission | null;
    evaluations: Evaluation[];
    feedback?: Feedback | null;
  }[];
}
