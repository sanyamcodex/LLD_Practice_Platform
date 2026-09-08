import { Submission, SubmissionStatus } from '../entities/Submission';

export interface SubmissionRepository {
  findById(id: string): Promise<Submission | null>;
  findByAttemptId(attemptId: string): Promise<Submission[]>;
  findByLearnerId(learnerId: string): Promise<Submission[]>;
  findExistingNonFailed(attemptId: string, contentHash: string): Promise<Submission | null>;
  save(submission: Submission, contentHash: string): Promise<Submission>;
  updateStatus(id: string, status: SubmissionStatus, failureReason?: string): Promise<Submission>;
}
