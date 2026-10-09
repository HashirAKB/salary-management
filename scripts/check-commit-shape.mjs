#!/usr/bin/env node
// commit-msg check for the red/green/refactor shape (D-059, amended by A-006).
// Wired in .husky/commit-msg after commitlint:  node scripts/check-commit-shape.mjs "$1"
// Runs for every commit, human or agent. No dependencies.
//
//   test(...)            must stage at least one test file (production stubs allowed)
//   feat(...) / fix(...) must not stage test files
//   refactor(...)        must not change test files and production files together
//   anything else        not checked
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const isTestFile = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
export const isProductionFile = (f) =>
       !isTestFile(f) && /^(apps\/[^/]+|packages\/[^/]+)\/src\//.test(f) && !/\/__fixtures__\//.test(f);

export function checkShape(message, stagedFiles) {
       const first = message.split('\n').find((l) => l.trim() && !l.startsWith('#')) || '';
       if (/^(Merge|Revert) /.test(first)) return null;
       const m = first.match(/^(\w+)(\([^)]*\))?!?:/);
       if (!m) return null; // commitlint reports format problems
       const type = m[1];
       const tests = stagedFiles.filter(isTestFile);
       const prod = stagedFiles.filter(isProductionFile);

       if (type === 'test' && tests.length === 0) {
              return 'A test(...) commit is the red step and must include at least one *.test.* or *.spec.* file.';
       }
       if ((type === 'feat' || type === 'fix') && tests.length > 0) {
              return `A ${type}(...) commit is the green step and must not change tests. Move these to a test(...) commit first:\n  ${tests.join('\n  ')}`;
       }
       if (type === 'refactor' && tests.length > 0 && prod.length > 0) {
              return 'A refactor(...) commit keeps tests unchanged while production code changes. Split test refactors and production refactors into separate commits.';
       }
       return null;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
       const msgFile = process.argv[2];
       if (!msgFile) {
              console.error('usage: check-commit-shape.mjs <commit-msg-file>');
              process.exit(2);
       }
       const message = readFileSync(msgFile, 'utf8');
       const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'], { encoding: 'utf8' })
              .split('\n')
              .filter(Boolean);
       const problem = checkShape(message, staged);
       if (problem) {
              console.error(`\ncommit shape (D-059): ${problem}\n`);
              process.exit(1);
       }
}
