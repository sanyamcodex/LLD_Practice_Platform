import { AttemptContent } from './Attempt';

/**
 * Submission Entity
 * An immutable snapshot of an attempt's content submitted for evaluation.
 * Decoupled from Attempt to guarantee that evaluation is performed against
 * an unchangeable historical record, even if the learner continues drafting.
 */

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
