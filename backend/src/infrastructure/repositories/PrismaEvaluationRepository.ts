import { Evaluation, EvaluatorType } from '../../domain/entities/Evaluation';
import { EvaluationRepository } from '../../domain/ports/EvaluationRepository';
import { DatabaseStorage } from './DatabaseStorage';
import { EvaluatorType as PrismaEvaluatorType } from '@prisma/client';

export class PrismaEvaluationRepository implements EvaluationRepository {
  private db = DatabaseStorage.getInstance();

  private toDomain(record: any): Evaluation {
    return {
      ...record,
      evaluatorType: record.evaluatorType as EvaluatorType, // Mapping Prisma EvaluatorType -> Domain EvaluatorType
    };
  }

  private toPrismaRecord(evaluation: Evaluation): any {
    return {
      ...evaluation,
      evaluatorType: evaluation.evaluatorType as PrismaEvaluatorType, // Mapping Domain EvaluatorType -> Prisma EvaluatorType
    };
  }

  async findById(id: string): Promise<Evaluation | null> {
    const table = this.db.get('evaluations');
    const item = table[id];
    return item ? this.toDomain(item) : null;
  }

  async findBySubmissionId(submissionId: string): Promise<Evaluation[]> {
    const table = this.db.get('evaluations');
    const all = (Object.values(table) as any[]).map((e) => this.toDomain(e));
    return all
      .filter((e) => e.submissionId === submissionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async save(evaluation: Evaluation): Promise<Evaluation> {
    const table = this.db.get('evaluations');
    const record = this.toPrismaRecord(evaluation);
    table[evaluation.id] = { ...record };
    this.db.flush();
    return this.toDomain(table[evaluation.id]);
  }
}
