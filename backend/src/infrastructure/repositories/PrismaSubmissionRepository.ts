import { Submission, SubmissionStatus } from '../../domain/entities/Submission';
import { SubmissionRepository } from '../../domain/ports/SubmissionRepository';
import { DatabaseStorage } from './DatabaseStorage';
import { SubmissionStatus as PrismaSubmissionStatus } from '@prisma/client';

interface StoredSubmissionRecord extends Omit<Submission, 'status'> {
  status: PrismaSubmissionStatus;
  contentHash: string;
}

export class PrismaSubmissionRepository implements SubmissionRepository {
  private db = DatabaseStorage.getInstance();

  private toDomain(record: StoredSubmissionRecord): Submission {
    const { contentHash, ...submission } = record;
    return {
      ...submission,
      status: record.status as SubmissionStatus, // Mapping Prisma SubmissionStatus -> Domain SubmissionStatus
    };
  }

  private toPrismaStatus(status: SubmissionStatus): PrismaSubmissionStatus {
    return status as PrismaSubmissionStatus; // Mapping Domain SubmissionStatus -> Prisma SubmissionStatus
  }

  async findById(id: string): Promise<Submission | null> {
    const table = this.db.get('submissions');
    const item = table[id] as StoredSubmissionRecord | undefined;
    if (!item) return null;
    return this.toDomain(item);
  }

  async findByAttemptId(attemptId: string): Promise<Submission[]> {
    const table = this.db.get('submissions');
    const all = Object.values(table) as StoredSubmissionRecord[];
    return all
      .filter((s) => s.attemptId === attemptId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((record) => this.toDomain(record));
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
      .map((record) => this.toDomain(record));
  }

  async findExistingNonFailed(attemptId: string, contentHash: string): Promise<Submission | null> {
    const table = this.db.get('submissions');
    const all = Object.values(table) as StoredSubmissionRecord[];
    const match = all.find(
      (s) => s.attemptId === attemptId && s.contentHash === contentHash && s.status !== 'FAILED'
    );
    if (!match) return null;
    return this.toDomain(match);
  }

  async save(submission: Submission, contentHash: string): Promise<Submission> {
    const table = this.db.get('submissions');
    const record: StoredSubmissionRecord = {
      ...submission,
      status: this.toPrismaStatus(submission.status),
      contentHash,
    };
    table[submission.id] = record;
    this.db.flush();
    return this.toDomain(record);
  }

  async updateStatus(id: string, status: SubmissionStatus, failureReason?: string): Promise<Submission> {
    const table = this.db.get('submissions');
    const record = table[id] as StoredSubmissionRecord | undefined;
    if (!record) {
      throw new Error(`Submission with id ${id} not found`);
    }
    record.status = this.toPrismaStatus(status);
    if (status === 'COMPLETED') {
      record.completedAt = new Date().toISOString();
    }
    if (failureReason) {
      record.failureReason = failureReason;
    }
    this.db.flush();
    return this.toDomain(record);
  }
}
