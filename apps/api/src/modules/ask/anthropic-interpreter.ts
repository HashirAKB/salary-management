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

// The slice of the SDK client the interpreter uses, so tests can stub it.
export interface MessagesClient {
  messages: { create(body: unknown, options?: unknown): Promise<unknown> };
}

interface ModelReply {
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
  content?: { type: string; name?: string; input?: unknown }[];
}

const REQUEST_TIMEOUT_MS = 15_000;

// 04 section 7.1: one request, two strict tools, tool_choice any, question only.
export class AnthropicInterpreter implements QueryInterpreter {
  private readonly tools: ReturnType<typeof buildToolSchemas>;
  private readonly querySchema: ReturnType<typeof buildStructuredQuerySchema>;
  private readonly cannotAnswerSchema = z.strictObject({
    reason: z.enum(CANNOT_ANSWER_REASONS as readonly [CannotAnswerReason, ...CannotAnswerReason[]]),
    suggestion: z.string(),
  });

  private readonly client: MessagesClient;
  private readonly options: { model: string; reference: AskReference };

  constructor(client: MessagesClient, options: { model: string; reference: AskReference }) {
    this.client = client;
    this.options = options;
    this.tools = buildToolSchemas(options.reference);
    this.querySchema = buildStructuredQuerySchema(options.reference);
  }

  async interpret(question: string, context: InterpretContext): Promise<InterpretResult> {
    let response: ModelReply;
    try {
      response = (await this.client.messages.create(
        {
          model: this.options.model,
          max_tokens: 512,
          system: buildSystemPrompt(context.today),
          tools: [this.tools.runPayQuery, this.tools.cannotAnswer],
          tool_choice: { type: 'any' },
          messages: [{ role: 'user', content: question }],
        },
        { timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 },
      )) as ModelReply;
    } catch (error) {
      throw new InterpreterError(error instanceof Error ? error.message : 'request failed');
    }

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      throw new InterpreterError(`stopped: ${response.stop_reason}`);
    }
    const call = response.content?.find((block) => block.type === 'tool_use');
    if (!call) throw new InterpreterError('no tool call');

    const tokens = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };

    if (call.name === 'run_pay_query') {
      const parsed = this.querySchema.safeParse(call.input);
      if (!parsed.success) throw new InterpreterError('invalid run_pay_query input');
      return { kind: 'query', query: parsed.data, ...tokens };
    }
    if (call.name === 'cannot_answer') {
      const parsed = this.cannotAnswerSchema.safeParse(call.input);
      if (!parsed.success) throw new InterpreterError('invalid cannot_answer input');
      return { kind: 'cannot_answer', ...parsed.data, ...tokens };
    }
    throw new InterpreterError(`unknown tool ${call.name}`);
  }
}
