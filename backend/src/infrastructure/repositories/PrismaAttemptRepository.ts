import { Attempt, AttemptStatus } from '../../domain/entities/Attempt';
import { AttemptRepository } from '../../domain/ports/AttemptRepository';
import { DatabaseStorage } from './DatabaseStorage';
import { AttemptStatus as PrismaAttemptStatus } from '@prisma/client';

export class PrismaAttemptRepository implements AttemptRepository {
  private db = DatabaseStorage.getInstance();

  private toDomain(record: any): Attempt {
    return {
      ...record,
      status: record.status as AttemptStatus, // Mapping Prisma AttemptStatus -> Domain AttemptStatus
    };
  }

  private toPrismaRecord(attempt: Attempt): any {
    return {
      ...attempt,
      status: attempt.status as PrismaAttemptStatus, // Mapping Domain AttemptStatus -> Prisma AttemptStatus
    };
  }

  async findById(id: string): Promise<Attempt | null> {
    const table = this.db.get('attempts');
    const item = table[id];
    return item ? this.toDomain(item) : null;
  }

  async findByLearnerId(learnerId: string): Promise<Attempt[]> {
    const table = this.db.get('attempts');
    const all = (Object.values(table) as any[]).map((a) => this.toDomain(a));
    return all.filter((a) => a.learnerId === learnerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findByProblemId(problemId: string, learnerId?: string): Promise<Attempt[]> {
    const table = this.db.get('attempts');
    const all = (Object.values(table) as any[]).map((a) => this.toDomain(a));
    return all
      .filter((a) => a.problemId === problemId && (!learnerId || a.learnerId === learnerId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async save(attempt: Attempt): Promise<Attempt> {
    const table = this.db.get('attempts');
    const record = this.toPrismaRecord(attempt);
    table[attempt.id] = { ...record };
    this.db.flush();
    return this.toDomain(table[attempt.id]);
  }

  async update(attempt: Attempt): Promise<Attempt> {
    const table = this.db.get('attempts');
    const record = this.toPrismaRecord(attempt);
    table[attempt.id] = { ...record, updatedAt: new Date().toISOString() };
    this.db.flush();
    return this.toDomain(table[attempt.id]);
  }
}
