import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../../config/env';
import { LLMClient, LLMClientEvaluationRequest, LLMClientEvaluationResponse } from '../../domain/ports/LLMClient';

export interface ModelPlan {
  model: string;
  timeoutMs: number;
  maxAttempts: number;
  isPrimary: boolean;
}

export interface GeminiClientOptions {
  apiKey?: string;
  primaryModel?: string;
  primaryTimeoutMs?: number;
  primaryMaxAttempts?: number;
  fallbackModel?: string;
  fallbackTimeoutMs?: number;
  fallbackMaxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  aiClient?: any;
}

export function extractStatusOrCode(err: any): string | number {
  if (!err) return 'UNKNOWN';
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  if (typeof err.code === 'number') return err.code;
  if (typeof err.code === 'string') return err.code;
  if (typeof err.status === 'string') return err.status;
  const msg = `${err.message || ''} ${err.statusText || ''} ${typeof err === 'string' ? err : ''}`.toLowerCase();
  if (msg.includes('503') || msg.includes('unavailable')) return 503;
  if (msg.includes('429') || msg.includes('resource_exhausted')) return 429;
  if (msg.includes('408') || msg.includes('timed out') || msg.includes('timeout')) return 408;
  if (msg.includes('500')) return 500;
  if (msg.includes('502')) return 502;
  if (msg.includes('504')) return 504;
  if (msg.includes('400')) return 400;
  if (msg.includes('401')) return 401;
  if (msg.includes('403')) return 403;
  return 'ERROR';
}

export function isNonRetryableClientError(err: any): boolean {
  if (!err) return false;
  const status = typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : null;
  if (status === 400 || status === 401 || status === 403) return true;
  const msg = `${err.message || ''} ${err.statusText || ''} ${typeof err === 'string' ? err : ''}`.toLowerCase();
  if (msg.includes('api_key_invalid') || msg.includes('permission_denied') || msg.includes('invalid argument')) {
    return true;
  }
  return false;
}

export function isTransientError(err: any): boolean {
  if (isNonRetryableClientError(err)) return false;
  if (!err) return false;

  const status = typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : null;
  const code = typeof err.code === 'string' ? err.code : typeof err.status === 'string' ? err.status : null;

  if (status === 503 || status === 429 || status === 408) return true;
  if (code === 'UNAVAILABLE' || code === 'RESOURCE_EXHAUSTED') return true;
  if (status !== null && status >= 500 && status < 600) return true;

  const msg = `${err.message || ''} ${err.statusText || ''} ${typeof err === 'string' ? err : ''}`.toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('408') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('high demand') ||
    msg.includes('temporarily overloaded') ||
    msg.includes('service unavailable') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

export function calculateBackoffWithJitter(
  attempt: number,
  baseBackoffMs: number = 750,
  maxBackoffMs: number = 2000
): number {
  // Exponential backoff: base * 2^(attempt - 1)
  const exponential = baseBackoffMs * Math.pow(2, attempt - 1);
  // Add uniform jitter between 0 and 250ms
  const jitter = Math.floor(Math.random() * 250);
  const calculated = Math.min(maxBackoffMs, exponential + jitter);
  return calculated;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * GeminiClient
 * Implements LLMClient port prioritizing reliability and availability:
 * 1. Primary AI evaluator: gemini-3.5-flash-lite (timeout 7,000ms, max 2 attempts with jittered backoff on transient errors)
 * 2. Secondary AI fallback: gemini-3.6-flash (timeout 7,000ms, max 1 attempt)
 * 3. Deterministic evaluator: final FR14 fallback handled by EvaluationOrchestrator
 */
export class GeminiClient implements LLMClient {
  private ai: any = null;
  public readonly options: Required<Omit<GeminiClientOptions, 'apiKey' | 'aiClient'>> & { apiKey?: string };

  constructor(options: GeminiClientOptions = {}) {
    this.options = {
      apiKey: options.apiKey,
      primaryModel: options.primaryModel || 'gemini-3.5-flash-lite',
      primaryTimeoutMs: options.primaryTimeoutMs ?? 7000,
      primaryMaxAttempts: options.primaryMaxAttempts ?? 2,
      fallbackModel: options.fallbackModel || 'gemini-3.6-flash',
      fallbackTimeoutMs: options.fallbackTimeoutMs ?? 7000,
      fallbackMaxAttempts: options.fallbackMaxAttempts ?? 1,
      baseBackoffMs: options.baseBackoffMs ?? 750,
      maxBackoffMs: options.maxBackoffMs ?? 2000,
    };
    if (options.aiClient) {
      this.ai = options.aiClient;
    }
  }

  private getClient(): any {
    if (!this.ai) {
      const apiKey = this.options.apiKey || config.geminiApiKey;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in the environment.');
      }
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.ai;
  }

  async evaluateDesign(request: LLMClientEvaluationRequest): Promise<LLMClientEvaluationResponse> {
    const ai = this.getClient();
    const { problem, submission, rubric } = request;
    const content = submission.contentSnapshot;

    const criteriaPrompt = rubric.criteria
      .map((c) => `- Key: "${c.key}" | Label: "${c.label}" | Description: ${c.description}`)
      .join('\n');

    const futureReqsPrompt = problem.futureRequirements
      .map((fr, i) => `Future Requirement ${i + 1}: ${fr}`)
      .join('\n');

    const prompt = `You are a Senior Principal Software Architect and Low-Level Design (LLD) Evaluator.
Your goal is to perform a rigorous, constructive, and evidence-grounded assessment of a software engineer's object-oriented low-level design.

### PROBLEM STATEMENT
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Description & Constraints:
${problem.description}

### STATED FUTURE REQUIREMENTS (For Extensibility Test)
${futureReqsPrompt}

### LEARNER'S SUBMITTED DESIGN ARTIFACT
[SECTION 1: ASSUMPTIONS & SCOPE]
${content.assumptions || '(None provided)'}

[SECTION 2: CORE CLASSES, INTERFACES & RESPONSIBILITIES]
${content.classesAndResponsibilities || '(None provided)'}

[SECTION 3: RELATIONSHIPS & COMPONENT INTERACTIONS]
${content.relationships || '(None provided)'}

[SECTION 4: EXTENSIBILITY & FUTURE REQUIREMENTS STRATEGY]
${content.extensibilityAnswer || '(None provided)'}

### EVALUATION CRITERIA (EVALUATE EXACTLY THESE 7 CRITERIA)
${criteriaPrompt}

### STRICT EVALUATION GUIDELINES
1. Ground EVERY criterion score in direct, quoted evidence from the submission (use "quotations"). If evidence is missing, state that clearly as the evidence.
2. Score each criterion between 0 and 5:
   - 0-1: Completely missing, fatally flawed, or God class architecture.
   - 2-3: Basic functional attempt, but suffers from tight coupling, missing abstraction, or SRP violations.
   - 4: Solid professional design with clear interfaces, low coupling, and sound trade-offs.
   - 5: Exemplary architectural craftsmanship gracefully absorbing future requirements.
3. Be candid, educational, and specific in 'concern' and 'suggestion'. Never output generic boilerplate.
4. Output structured JSON matching the provided schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        overallSummary: {
          type: Type.STRING,
          description: 'A 2-3 sentence executive synthesis of the design strengths, architectural risks, and main recommendation.',
        },
        results: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              criterionKey: {
                type: Type.STRING,
                description: 'One of the 7 fixed rubric criterion keys (e.g. requirement_understanding, class_responsibilities, coupling_cohesion, encapsulation_interfaces, abstraction_pattern_use, extensibility, explanation_quality)',
              },
              score: {
                type: Type.INTEGER,
                description: 'Integer score from 0 to 5',
              },
              evidence: {
                type: Type.STRING,
                description: 'Direct quote or concrete citation from the submission justifying the score',
              },
              concern: {
                type: Type.STRING,
                description: 'Specific vulnerability, architectural smell, or unhandled requirement',
              },
              suggestion: {
                type: Type.STRING,
                description: 'Concrete actionable design improvement or pattern refactoring advice',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Confidence score between 0.0 and 1.0',
              },
            },
            required: ['criterionKey', 'score', 'evidence', 'concern', 'suggestion', 'confidence'],
          },
        },
      },
      required: ['overallSummary', 'results'],
    };

    // Candidate models in strict preference order:
    // 1. gemini-3.5-flash-lite (timeout: 7000ms, maxAttempts: 2, jittered backoff on transient failure)
    // 2. gemini-3.6-flash (timeout: 7000ms, maxAttempts: 1, no long retry chain)
    const modelPlans: ModelPlan[] = [
      {
        model: this.options.primaryModel,
        timeoutMs: this.options.primaryTimeoutMs,
        maxAttempts: this.options.primaryMaxAttempts,
        isPrimary: true,
      },
      {
        model: this.options.fallbackModel,
        timeoutMs: this.options.fallbackTimeoutMs,
        maxAttempts: this.options.fallbackMaxAttempts,
        isPrimary: false,
      },
    ];

    let lastError: any = null;

    for (let planIndex = 0; planIndex < modelPlans.length; planIndex++) {
      const plan = modelPlans[planIndex];

      if (!plan.isPrimary) {
        console.log(`[GeminiClient] Primary model failed; invoking fallback model=${plan.model}`);
      }

      for (let attempt = 1; attempt <= plan.maxAttempts; attempt++) {
        try {
          console.log(`[GeminiClient] Request started: model=${plan.model} attempt=${attempt}/${plan.maxAttempts} timeout=${plan.timeoutMs}ms`);

          const generatePromise = ai.models.generateContent({
            model: plan.model,
            contents: prompt,
            config: {
              systemInstruction:
                'You are an authoritative Low-Level Design evaluator. Always provide constructive, evidence-based feedback formatted as valid JSON adhering to the exact responseSchema.',
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const response = await withTimeout<any>(
            generatePromise,
            plan.timeoutMs,
            `Gemini API request (${plan.model})`
          );

          const text = response?.text;
          if (!text) {
            throw new Error(`Empty response received from Gemini API with model ${plan.model}`);
          }

          const parsed = JSON.parse(text) as LLMClientEvaluationResponse;
          if (!parsed.overallSummary || !Array.isArray(parsed.results)) {
            throw new Error(`Invalid schema returned from Gemini API with model ${plan.model}`);
          }

          parsed.modelUsed = plan.model;
          console.log(`[GeminiClient] Final AI success: model=${plan.model}`);
          return parsed;
        } catch (err: any) {
          lastError = err;
          const statusOrCode = extractStatusOrCode(err);

          // 400 / 401 / 403 client errors should not be retried repeatedly
          if (isNonRetryableClientError(err)) {
            console.warn(`[GeminiClient] Client error: model=${plan.model} status=${statusOrCode} error=${err?.message || err}`);
            break;
          }

          if (isTransientError(err)) {
            console.warn(`[GeminiClient] Transient failure: model=${plan.model} status=${statusOrCode}`);

            if (attempt < plan.maxAttempts) {
              const delayMs = calculateBackoffWithJitter(attempt, this.options.baseBackoffMs, this.options.maxBackoffMs);
              console.log(`[GeminiClient] Retrying model=${plan.model} after ${delayMs}ms`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            } else {
              break;
            }
          } else {
            console.warn(`[GeminiClient] AI failure (non-transient): model=${plan.model} error=${err?.message || err}`);
            break;
          }
        }
      }
    }

    console.error(`[GeminiClient] All AI models failed; invoking deterministic FR14 fallback`);
    throw lastError || new Error(`All candidate AI models (${modelPlans.map((p) => p.model).join(', ')}) failed.`);
  }
}
