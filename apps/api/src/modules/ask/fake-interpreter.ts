import type { InterpretContext, InterpretResult, QueryInterpreter } from './interpreter.ts';

// 04 section 7.5: answers from a fixed map keyed by the exact question.
export class FakeInterpreter implements QueryInterpreter {
  private readonly answers: Map<string, InterpretResult>;
  private readonly options: { throws?: boolean };

  constructor(answers: Map<string, InterpretResult>, options: { throws?: boolean } = {}) {
    this.answers = answers;
    this.options = options;
  }

  async interpret(question: string, _context: InterpretContext): Promise<InterpretResult> {
    if (this.options.throws) throw new Error('fake interpreter failure');
    return (
      this.answers.get(question) ?? {
        kind: 'cannot_answer',
        reason: 'unclear',
        suggestion: 'How does total payroll split by country?',
      }
    );
  }
}
