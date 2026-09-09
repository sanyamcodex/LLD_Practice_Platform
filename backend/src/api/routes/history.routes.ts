import { Router, Request, Response, NextFunction } from 'express';
import { AttemptService } from '../../application/AttemptService';
import { SubmissionService } from '../../application/SubmissionService';
import { SubmissionRepository } from '../../domain/ports/SubmissionRepository';
import { EvaluationRepository } from '../../domain/ports/EvaluationRepository';
import { ProblemRepository } from '../../domain/ports/ProblemRepository';
import { Evaluation } from '../../domain/entities/Evaluation';

export function createHistoryRouter(
  attemptService: AttemptService,
  submissionRepo: SubmissionRepository,
  evaluationRepo: EvaluationRepository,
  problemRepo: ProblemRepository,
  submissionService: SubmissionService
): Router {
  const router = Router();

  // GET /api/history - List all attempts and their submissions for the learner
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const learnerId = (req.query.learnerId as string) || 'learner_default';
      const attempts = await attemptService.getAttemptsByLearner(learnerId);
      const problems = await problemRepo.findAll();
      const problemMap = new Map(problems.map((p) => [p.id, p]));

      const historyItems = await Promise.all(
        attempts.map(async (attempt) => {
          const submissions = await submissionRepo.findByAttemptId(attempt.id);
          const latestSubmission = submissions[0] || null;
          let evaluations: Evaluation[] = [];
          let feedback = null;
          let finalSubmission = latestSubmission;

          if (latestSubmission && latestSubmission.status === 'COMPLETED') {
            const statusResult = await submissionService.getSubmissionStatus(latestSubmission.id);
            feedback = statusResult.feedback;
            finalSubmission = statusResult.submission;
            const rawEvals = await evaluationRepo.findBySubmissionId(latestSubmission.id);
            // Sort evaluations descending (most recent first)
            evaluations = [...rawEvals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          }

          const problem = problemMap.get(attempt.problemId);

          return {
            attempt,
            problem: problem || null,
            latestSubmission: finalSubmission,
            evaluations,
            feedback,
          };
        })
      );

      res.json(historyItems);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/history/problems/:problemId - Attempts for one problem (compare across attempts)
  router.get('/problems/:problemId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { problemId } = req.params;
      const learnerId = (req.query.learnerId as string) || 'learner_default';
      const attempts = await attemptService.getAttemptsByProblem(problemId, learnerId);
      const problem = await problemRepo.findById(problemId);

      const items = await Promise.all(
        attempts.map(async (attempt) => {
          const submissions = await submissionRepo.findByAttemptId(attempt.id);
          const latestSubmission = submissions[0] || null;
          let evaluations: Evaluation[] = [];
          let feedback = null;
          let finalSubmission = latestSubmission;

          if (latestSubmission && latestSubmission.status === 'COMPLETED') {
            const statusResult = await submissionService.getSubmissionStatus(latestSubmission.id);
            feedback = statusResult.feedback;
            finalSubmission = statusResult.submission;
            const rawEvals = await evaluationRepo.findBySubmissionId(latestSubmission.id);
            evaluations = [...rawEvals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          }

          return {
            attempt,
            latestSubmission: finalSubmission,
            evaluations,
            feedback,
          };
        })
      );

      res.json({
        problem,
        attempts: items,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
