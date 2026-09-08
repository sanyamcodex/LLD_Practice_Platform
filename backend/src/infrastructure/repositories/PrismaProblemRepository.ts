import { Problem } from '../../domain/entities/Problem';
import { ProblemRepository } from '../../domain/ports/ProblemRepository';
import { DatabaseStorage } from './DatabaseStorage';

export class PrismaProblemRepository implements ProblemRepository {
  private db = DatabaseStorage.getInstance();

  async findAll(): Promise<Problem[]> {
    const table = this.db.get('problems');
    return Object.values(table) as Problem[];
  }

  async findById(id: string): Promise<Problem | null> {
    const table = this.db.get('problems');
    const problem = table[id];
    return problem ? (problem as Problem) : null;
  }

  async save(problem: Problem): Promise<void> {
    const table = this.db.get('problems');
    table[problem.id] = {
      ...problem,
      updatedAt: new Date().toISOString(),
      createdAt: problem.createdAt || new Date().toISOString(),
    };
    this.db.flush();
  }

  async saveMany(problems: Problem[]): Promise<void> {
    const table = this.db.get('problems');
    const now = new Date().toISOString();
    for (const p of problems) {
      table[p.id] = {
        ...p,
        createdAt: p.createdAt || now,
        updatedAt: now,
      };
    }
    this.db.flush();
  }
}
