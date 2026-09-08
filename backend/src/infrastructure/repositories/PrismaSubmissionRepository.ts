import { Submission, SubmissionStatus } from '../../domain/entities/Submission';
import { SubmissionRepository } from '../../domain/ports/SubmissionRepository';
import { DatabaseStorage } from './DatabaseStorage';

interface StoredSubmissionRecord extends Submission {
  contentHash: string;
}

export class PrismaSubmissionRepository implements SubmissionRepository {
  private db = DatabaseStorage.getInstance();

  async findById(id: string): Promise<Submission | null> {
    const table = this.db.get('submissions');
    const item = table[id] as StoredSubmissionRecord | undefined;
    if (!item) return null;
    const { contentHash, ...submission } = item;
    return submission;
  }

  async findByAttemptId(attemptId: string): Promise<Submission[]> {
    const table = this.db.get('submissions');
    const all = Object.values(table) as StoredSubmissionRecord[];
    return all
      .filter((s) => s.attemptId === attemptId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ contentHash, ...s }) => s);
  }

  async findByLearnerId(learnerId: string): Promise<Submission[]> {
    const attemptTable = this.db.get('attempts');
    const submissionTable = this.db.get('submissions');
    const learnerAttemptIds = new Set(
      Object.values(attemptTable)
        .filter((a: any) => a.learnerId === learnerId)
        .map((a: any) => a.id)
    );

    const all = Object.values(submissionTable) as StoredSubmissionRecord[];
    return all
      .filter((s) => learnerAttemptIds.has(s.attemptId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ contentHash, ...s }) => s);
  }

  async findExistingNonFailed(attemptId: string, contentHash: string): Promise<Submission | null> {
    const table = this.db.get('submissions');
    const all = Object.values(table) as StoredSubmissionRecord[];
    const match = all.find(
      (s) => s.attemptId === attemptId && s.contentHash === contentHash && s.status !== 'FAILED'
    );
    if (!match) return null;
    const { contentHash: _ch, ...submission } = match;
    return submission;
  }

  async save(submission: Submission, contentHash: string): Promise<Submission> {
    const table = this.db.get('submissions');
    const record: StoredSubmissionRecord = {
      ...submission,
      contentHash,
    };
    table[submission.id] = record;
    this.db.flush();
    return submission;
  }

  async updateStatus(id: string, status: SubmissionStatus, failureReason?: string): Promise<Submission> {
    const table = this.db.get('submissions');
    const record = table[id] as StoredSubmissionRecord | undefined;
    if (!record) {
      throw new Error(`Submission with id ${id} not found`);
    }
    record.status = status;
    if (status === 'COMPLETED') {
      record.completedAt = new Date().toISOString();
    }
    if (failureReason) {
      record.failureReason = failureReason;
    }
    this.db.flush();
    const { contentHash, ...sub } = record;
    return sub;
  }
}
