#!/usr/bin/env node
// Stop hook (D-064): Claude cannot end a turn while tests or typecheck fail.
//
// Allows the stop without running anything when:
//   - the session is in plan mode (no edits are possible),
//   - Claude's last message starts with "BLOCKED:" (it is asking me a question),
//   - there is no package.json, or it has no "test" or "typecheck" script yet (before S0),
//   - the exact working tree already passed (cached by tree hash).
// Otherwise runs `npm test` then `npm run typecheck` and blocks with the failing
// output. Claude Code itself overrides a Stop hook after 8 consecutive blocks with
// no tool call in between, so a stuck loop cannot run forever.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const input = (() => {
       try {
              return JSON.parse(readFileSync(0, 'utf8') || '{}');
       } catch {
              return {};
       }
})();
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

const allow = (message) => {
       if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
       process.exit(0);
};
const block = (reason) => {
       process.stdout.write(JSON.stringify({ decision: 'block', reason }));
       process.exit(0);
};
const git = (args, env = {}) =>
       spawnSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });

if (input.permission_mode === 'plan') allow();
if ((input.last_assistant_message || '').trimStart().startsWith('BLOCKED:')) {
       allow('Stop gate skipped: Claude is waiting on a BLOCKED: question.');
}

// .ai-notes must never be tracked, whatever route got it into the index (D-007).
const tracked = git(['ls-files', '--', '.ai-notes']);
if (tracked.status === 0 && tracked.stdout.trim()) {
       block(
              `These .ai-notes/ files are tracked by git:\n${tracked.stdout}\n` +
              'Untrack them with `git rm -r --cached .ai-notes`, make sure .gitignore lists `.ai-notes/`, and commit that as chore. Never commit .ai-notes/ (D-007).',
       );
}

const pkgPath = join(root, 'package.json');
if (!existsSync(pkgPath)) allow();
let scripts = {};
try {
       scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts || {};
} catch {
       block('package.json is not valid JSON. Fix it before finishing.');
}
const missing = ['test', 'typecheck'].filter((s) => !scripts[s]);
if (missing.length) {
       allow(`Stop gate inactive: package.json has no ${missing.join(' or ')} script yet.`);
}

// Cache key: the tree of HEAD plus every tracked and untracked (non-ignored) change.
function treeHash() {
       const indexFile = join(tmpdir(), `stop-gate-index-${process.pid}`);
       const env = { GIT_INDEX_FILE: indexFile };
       try {
              if (git(['rev-parse', '--verify', '-q', 'HEAD']).status === 0) git(['read-tree', 'HEAD'], env);
              if (git(['add', '-A'], env).status !== 0) return null;
              const r = git(['write-tree'], env);
              return r.status === 0 ? r.stdout.trim() : null;
       } finally {
              rmSync(indexFile, { force: true });
       }
}
const cacheDir = join(root, 'node_modules', '.cache', 'claude-stop-gate');
const cacheFile = join(cacheDir, 'last-green');
const key = treeHash();
if (key && existsSync(cacheFile) && readFileSync(cacheFile, 'utf8').trim() === key) allow();

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
const tail = (s, n) => stripAnsi(s).trimEnd().split('\n').slice(-n).join('\n');
const run = (args) =>
       spawnSync('npm', args, {
              cwd: root,
              encoding: 'utf8',
              shell: process.platform === 'win32',
              env: { ...process.env, CI: 'true', TZ: 'UTC', FORCE_COLOR: '0' },
              maxBuffer: 64 * 1024 * 1024,
       });

for (const [label, args] of [
       ['npm test', ['test']],
       ['npm run typecheck', ['run', 'typecheck']],
]) {
       const r = run(args);
       if (r.status !== 0) {
              block(
                     `Stop gate: \`${label}\` failed (exit ${r.status}). You cannot finish the turn on a red or type-broken tree.\n` +
                     'Fix the cause in production code or test setup. Do not skip, weaken or delete a test to get past this. ' +
                     'If you are stuck on a question the docs do not answer, start your reply with "BLOCKED:" and ask.\n\n' +
                     `Last lines of output:\n${tail(`${r.stdout || ''}\n${r.stderr || ''}`, 60)}`,
              );
       }
}

if (key) {
       try {
              mkdirSync(cacheDir, { recursive: true });
              writeFileSync(cacheFile, key);
       } catch {
              // Cache is an optimisation only.
       }
}
allow();
