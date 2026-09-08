import { Evaluation } from '../../domain/entities/Evaluation';
import { EvaluationRepository } from '../../domain/ports/EvaluationRepository';
import { DatabaseStorage } from './DatabaseStorage';

export class PrismaEvaluationRepository implements EvaluationRepository {
  private db = DatabaseStorage.getInstance();

  async findById(id: string): Promise<Evaluation | null> {
    const table = this.db.get('evaluations');
    const item = table[id];
    return item ? (item as Evaluation) : null;
  }

  async findBySubmissionId(submissionId: string): Promise<Evaluation[]> {
    const table = this.db.get('evaluations');
    const all = Object.values(table) as Evaluation[];
    return all
      .filter((e) => e.submissionId === submissionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async save(evaluation: Evaluation): Promise<Evaluation> {
    const table = this.db.get('evaluations');
    table[evaluation.id] = { ...evaluation };
    this.db.flush();
    return evaluation;
  }
}
