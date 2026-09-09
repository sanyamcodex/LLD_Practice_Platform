import { Problem, Difficulty } from '../../domain/entities/Problem';
import { ProblemRepository } from '../../domain/ports/ProblemRepository';
import { DatabaseStorage } from './DatabaseStorage';
import { Difficulty as PrismaDifficulty } from '@prisma/client';

export class PrismaProblemRepository implements ProblemRepository {
  private db = DatabaseStorage.getInstance();

  private toDomain(record: any): Problem {
    return {
      ...record,
      difficulty: record.difficulty as Difficulty, // Mapping Prisma Difficulty -> Domain Difficulty
    };
  }

  private toPrismaRecord(problem: Problem): any {
    return {
      ...problem,
      difficulty: problem.difficulty as PrismaDifficulty, // Mapping Domain Difficulty -> Prisma Difficulty
    };
  }

  async findAll(): Promise<Problem[]> {
    const table = this.db.get('problems');
    return (Object.values(table) as any[]).map((p) => this.toDomain(p));
  }

  async findById(id: string): Promise<Problem | null> {
    const table = this.db.get('problems');
    const problem = table[id];
    return problem ? this.toDomain(problem) : null;
  }

  async save(problem: Problem): Promise<void> {
    const table = this.db.get('problems');
    const record = this.toPrismaRecord(problem);
    table[problem.id] = {
      ...record,
      updatedAt: new Date().toISOString(),
      createdAt: problem.createdAt || new Date().toISOString(),
    };
    this.db.flush();
  }

  async saveMany(problems: Problem[]): Promise<void> {
    const table = this.db.get('problems');
    const now = new Date().toISOString();
    for (const p of problems) {
      const record = this.toPrismaRecord(p);
      table[p.id] = {
        ...record,
        createdAt: p.createdAt || now,
        updatedAt: now,
      };
    }
    this.db.flush();
  }
}
