import { Router, Request, Response, NextFunction } from 'express';
import { SubmissionService } from '../../application/SubmissionService';

export function createSubmissionsRouter(submissionService: SubmissionService): Router {
  const router = Router();

  // GET /api/submissions/:id - Poll submission status + feedback
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await submissionService.getSubmissionStatus(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/submissions/:id/reevaluate - Re-trigger evaluation on an existing submission
  router.post('/:id/reevaluate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await submissionService.reevaluateSubmission(req.params.id);
      res.status(202).json({
        message: 'Submission re-evaluation enqueued',
        submission: result,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
