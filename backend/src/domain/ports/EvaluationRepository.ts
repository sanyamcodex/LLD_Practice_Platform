import { Evaluation } from '../entities/Evaluation';

export interface EvaluationRepository {
  findById(id: string): Promise<Evaluation | null>;
  findBySubmissionId(submissionId: string): Promise<Evaluation[]>;
  save(evaluation: Evaluation): Promise<Evaluation>;
}
