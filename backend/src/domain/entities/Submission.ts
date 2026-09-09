import { AttemptContent } from './Attempt';
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
