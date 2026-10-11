import type { AskReference } from '@acme/shared';

export interface ToolDefinition {
  name: string;
  description: string;
  strict: true;
  input_schema: Record<string, unknown>;
}

// 04 section 7.2: built once at startup from the reference data.
export function buildToolSchemas(_reference: AskReference): {
  runPayQuery: ToolDefinition;
  cannotAnswer: ToolDefinition;
} {
  throw new Error('not implemented');
}
