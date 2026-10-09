# ADR 0001: TypeScript throughout

- Status: Accepted (records D-001)
- Date: 2026-10-09

## Context

The brief asks for a backend in the role's language and a React or Next.js UI. The role is a Software Craftsperson position whose main fit is Node, React and TypeScript. The API and the UI must agree on many shapes: employee records, money values, list filters, validation rules and the structured query behind "Ask about pay". With two languages, each of these would be defined twice and could drift.

## Decision

TypeScript everywhere: a Node API, a React UI, and a shared package holding zod schemas, types and money helpers that both import.

## Alternatives considered

- **Java with Spring and Angular.** The brief allows it, but it's a weaker fit for the role, and nothing could be shared between API and UI.
- **Python backend with a React UI.** Two languages, two copies of every validation rule.

## Consequences

- One validation source: a rule changed in `packages/shared` changes the API and the forms together.
- One test runner (Vitest) and one linting setup across the repo.
- TypeScript types disappear at runtime, so every trust boundary (HTTP input, env vars, LLM tool output) is still parsed with zod.
