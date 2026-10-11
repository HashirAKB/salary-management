import {
  buildStructuredQuerySchema,
  CANNOT_ANSWER_REASONS,
  type AskReference,
  type CannotAnswerReason,
} from '@acme/shared';
import { z } from 'zod';
import {
  InterpreterError,
  type InterpretContext,
  type InterpretResult,
  type QueryInterpreter,
} from './interpreter.ts';
import { buildSystemPrompt } from './system-prompt.ts';
import { buildToolSchemas } from './tool-schema.ts';

// The slice of `fetch` the interpreter uses, so tests can stub it.
export type FetchFn = (
  url: string,
  init: Record<string, unknown>,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface GeminiReply {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; functionCall?: { name: string; args?: unknown } }[] };
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

const REQUEST_TIMEOUT_MS = 15_000;
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// ADR 0009: Gemini over its REST API. One request, two function declarations, a forced function
// call, the question only. Same contract as the Anthropic interpreter.
export class GeminiInterpreter implements QueryInterpreter {
  private readonly tools: ReturnType<typeof buildToolSchemas>;
  private readonly querySchema: ReturnType<typeof buildStructuredQuerySchema>;
  private readonly cannotAnswerSchema = z.strictObject({
    reason: z.enum(CANNOT_ANSWER_REASONS as readonly [CannotAnswerReason, ...CannotAnswerReason[]]),
    suggestion: z.string(),
  });

  private readonly fetchFn: FetchFn;
  private readonly options: { apiKey: string; model: string; reference: AskReference };

  constructor(
    fetchFn: FetchFn,
    options: { apiKey: string; model: string; reference: AskReference },
  ) {
    this.fetchFn = fetchFn;
    this.options = options;
    this.tools = buildToolSchemas(options.reference);
    this.querySchema = buildStructuredQuerySchema(options.reference);
  }

  async interpret(question: string, context: InterpretContext): Promise<InterpretResult> {
    const declarations = [this.tools.runPayQuery, this.tools.cannotAnswer].map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.input_schema,
    }));

    let reply: GeminiReply;
    try {
      const response = await this.fetchFn(`${ENDPOINT}/${this.options.model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.options.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemPrompt(context.today) }] },
          contents: [{ role: 'user', parts: [{ text: question }] }],
          tools: [{ functionDeclarations: declarations }],
          toolConfig: { functionCallingConfig: { mode: 'ANY' } },
          generationConfig: { maxOutputTokens: 512 },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = (await response.json().catch(() => ({}))) as GeminiReply & {
        error?: { message?: string };
      };
      if (!response.ok) {
        const detail = payload.error?.message;
        throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      }
      reply = payload;
    } catch (error) {
      throw new InterpreterError(error instanceof Error ? error.message : 'request failed');
    }

    if (reply.promptFeedback?.blockReason) {
      throw new InterpreterError(`blocked: ${reply.promptFeedback.blockReason}`);
    }
    const candidate = reply.candidates?.[0];
    if (!candidate) throw new InterpreterError('no candidate');
    // A function call finishes with STOP; SAFETY, MAX_TOKENS and the rest mean no usable call.
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new InterpreterError(`stopped: ${candidate.finishReason}`);
    }
    const call = candidate.content?.parts?.find((part) => part.functionCall)?.functionCall;
    if (!call) throw new InterpreterError('no function call');

    const tokens = {
      inputTokens: reply.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: reply.usageMetadata?.candidatesTokenCount ?? 0,
    };

    if (call.name === 'run_pay_query') {
      const parsed = this.querySchema.safeParse(call.args);
      if (!parsed.success) throw new InterpreterError('invalid run_pay_query input');
      return { kind: 'query', query: parsed.data, ...tokens };
    }
    if (call.name === 'cannot_answer') {
      const parsed = this.cannotAnswerSchema.safeParse(call.args);
      if (!parsed.success) throw new InterpreterError('invalid cannot_answer input');
      return { kind: 'cannot_answer', ...parsed.data, ...tokens };
    }
    throw new InterpreterError(`unknown function ${call.name}`);
  }
}
