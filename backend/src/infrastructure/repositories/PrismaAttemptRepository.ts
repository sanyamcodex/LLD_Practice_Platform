import { Attempt } from '../../domain/entities/Attempt';
import { AttemptRepository } from '../../domain/ports/AttemptRepository';
import { DatabaseStorage } from './DatabaseStorage';

export class PrismaAttemptRepository implements AttemptRepository {
  private db = DatabaseStorage.getInstance();

  async findById(id: string): Promise<Attempt | null> {
    const table = this.db.get('attempts');
    const item = table[id];
    return item ? (item as Attempt) : null;
  }

  async findByLearnerId(learnerId: string): Promise<Attempt[]> {
    const table = this.db.get('attempts');
    const all = Object.values(table) as Attempt[];
    return all.filter((a) => a.learnerId === learnerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findByProblemId(problemId: string, learnerId?: string): Promise<Attempt[]> {
    const table = this.db.get('attempts');
    const all = Object.values(table) as Attempt[];
    return all
      .filter((a) => a.problemId === problemId && (!learnerId || a.learnerId === learnerId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async save(attempt: Attempt): Promise<Attempt> {
    const table = this.db.get('attempts');
    table[attempt.id] = { ...attempt };
    this.db.flush();
    return attempt;
  }

  async update(attempt: Attempt): Promise<Attempt> {
    const table = this.db.get('attempts');
    table[attempt.id] = { ...attempt, updatedAt: new Date().toISOString() };
    this.db.flush();
    return table[attempt.id] as Attempt;
  }
}
