/**
 * Attempt Entity
 * Represents a learner's interactive design attempt for a given problem.
 * Mutable while in 'IN_PROGRESS' state, enabling draft saves before formal submission.
 */

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED';

export interface AttemptContent {
  assumptions: string;
  classesAndResponsibilities: string;
  relationships: string;
  extensibilityAnswer: string;
}

export interface Attempt {
  id: string;
  problemId: string;
  learnerId: string;
  status: AttemptStatus;
  content: AttemptContent;
  createdAt: string;
  updatedAt: string;
}
