import { Router, Request, Response, NextFunction } from 'express';
import { AttemptService } from '../../application/AttemptService';
import { SubmissionService } from '../../application/SubmissionService';
import { AppError } from '../middleware/AppError';

export function createAttemptsRouter(
  attemptService: AttemptService,
  submissionService: SubmissionService
): Router {
  const router = Router();

  // POST /api/attempts - Start an attempt
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { problemId, learnerId } = req.body;
      if (!problemId) {
        throw AppError.badRequest('problemId is required to start an attempt');
      }
      const attempt = await attemptService.startAttempt(problemId, learnerId || 'learner_default');
      res.status(201).json(attempt);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/attempts/:id - Get attempt by id
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attempt = await attemptService.getAttempt(req.params.id);
      res.json(attempt);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/attempts/:id - Save draft content
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assumptions, classesAndResponsibilities, relationships, extensibilityAnswer } = req.body;
      const updated = await attemptService.saveDraft(req.params.id, {
        assumptions,
        classesAndResponsibilities,
        relationships,
        extensibilityAnswer,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/attempts/:id/submit - Submit attempt (creates & returns Submission snapshot)
  router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submission = await submissionService.submitAttempt(req.params.id);
      res.status(200).json(submission);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
