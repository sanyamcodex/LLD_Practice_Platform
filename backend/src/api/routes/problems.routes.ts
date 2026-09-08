import { Router, Request, Response, NextFunction } from 'express';
import { ProblemService } from '../../application/ProblemService';

export function createProblemsRouter(problemService: ProblemService): Router {
  const router = Router();

  // GET /api/problems - List all problems
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const problems = await problemService.listProblems();
      res.json(problems);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/problems/:id - Get problem detail
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const problem = await problemService.getProblemById(req.params.id);
      res.json(problem);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
