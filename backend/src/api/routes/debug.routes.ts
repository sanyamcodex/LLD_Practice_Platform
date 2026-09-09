import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { config } from '../../config/env';

export function createDebugRouter(): Router {
  const router = Router();

  // Debug Authorization Middleware
  router.use((req: Request, res: Response, next) => {
    const expectedToken = process.env.DEBUG_TOKEN || process.env.DIAGNOSTIC_SECRET || 'lld-debug-token-2026';

    const headerToken = req.headers['x-debug-token'] as string | undefined;
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const queryToken = req.query.token as string | undefined;

    const providedToken = headerToken || bearerToken || queryToken;

    if (!providedToken || providedToken !== expectedToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Valid debug token required (header x-debug-token or Authorization: Bearer <token>)',
      });
    }

    next();
  });

  const handleGeminiDiagnostic = async (req: Request, res: Response) => {
    const model = (req.body?.model || req.query?.model || 'gemini-3.5-flash-lite') as string;
    const prompt = 'Reply with exactly GEMINI_OK';
    const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        model,
        errorType: 'ConfigurationError',
        message: 'GEMINI_API_KEY environment variable is missing',
      });
    }

    const startTime = Date.now();
    console.log(`[GeminiDiagnostic] Request started: model=${model} timestamp=${new Date().toISOString()}`);

    const abortController = new AbortController();
    const timeoutMs = Number(req.body?.timeoutMs || req.query?.timeoutMs) || 15000;
    const timer = setTimeout(() => {
      abortController.abort(new Error(`Diagnostic request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          abortSignal: abortController.signal,
        },
      });

      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const responseText = response?.text?.trim() || '';

      console.log(`[GeminiDiagnostic] Response received: model=${model} duration=${durationMs}ms status=200 responseText=${responseText}`);

      return res.status(200).json({
        success: true,
        model,
        prompt,
        durationMs,
        status: 200,
        responseText,
      });
    } catch (err: any) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const errorType = err.name || 'Error';
      const status = err.status || (err.message && err.message.includes('timed out') ? 408 : 500);

      console.error(`[GeminiDiagnostic] Request failed: model=${model} duration=${durationMs}ms status=${status} errorType=${errorType} message=${err.message}`);

      return res.status(status >= 400 && status < 600 ? status : 500).json({
        success: false,
        model,
        durationMs,
        status,
        errorType,
        message: err.message,
      });
    }
  };

  // Support both POST (as requested) and GET for ease of diagnostic testing
  router.post('/gemini', handleGeminiDiagnostic);
  router.get('/gemini', handleGeminiDiagnostic);

  return router;
}
