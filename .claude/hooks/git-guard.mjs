#!/usr/bin/env node
// PreToolUse guard for Bash calls (D-065).
// Denies git commands that would bypass the commit hooks, commit AI notes,
// or rewrite graded history. Exit 0 with a JSON deny, or exit 0 silently.
// Threat model: an agent drifting from the rules, not an adversary. Commands
// hidden inside `sh -c '...'` strings or variables are out of scope; the
// husky hooks and CI still apply to anything that slips past this guard.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function readInput() {
       try {
              return JSON.parse(readFileSync(0, 'utf8') || '{}');
       } catch {
              return {};
       }
}

function deny(reason) {
       process.stdout.write(
              JSON.stringify({
                     hookSpecificOutput: {
                            hookEventName: 'PreToolUse',
                            permissionDecision: 'deny',
                            permissionDecisionReason: reason,
                     },
              }),
       );
       process.exit(0);
}

// Remove text that is commit-message content, so a message that mentions
// "--no-verify" or ".ai-notes" is not mistaken for the flag or the path.
export function stripMessages(command) {
       let s = command;
       // Heredoc bodies: <<'EOF' ... EOF, <<-EOF ... EOF, <<"EOF" ... EOF
       s = s.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$|\))/g, '<<HEREDOC');
       // -m "..." / -m '...' / --message="..." / --message '...'
       s = s.replace(/(\s(?:-m|--message)(?:=|\s+))("(?:[^"\\]|\\.)*"|'[^']*')/g, '$1""');
       // -m"..." (no space)
       s = s.replace(/(\s-m)("(?:[^"\\]|\\.)*"|'[^']*')/g, '$1""');
       return s;
}

// Split on shell separators outside quotes. Good enough for the commands an
// agent writes; not a full shell parser.
export function segments(command) {
       const out = [];
       let cur = '';
       let quote = null;
       for (let i = 0; i < command.length; i++) {
              const c = command[i];
              if (quote) {
                     cur += c;
                     if (c === quote) quote = null;
                     continue;
              }
              if (c === '"' || c === "'") {
                     quote = c;
                     cur += c;
                     continue;
              }
              const two = command.slice(i, i + 2);
              if (two === '&&' || two === '||') {
                     out.push(cur);
                     cur = '';
                     i++;
                     continue;
              }
              if (c === ';' || c === '\n' || c === '|' || (c === '&' && command[i - 1] !== '>' && command[i + 1] !== '>')) {
                     out.push(cur);
                     cur = '';
                     continue;
              }
              cur += c;
       }
       out.push(cur);
       return out.map((x) => x.trim()).filter(Boolean);
}

const unquote = (t) => t.replace(/^['"]|['"]$/g, '');

// Returns the git subcommand and its arguments for a segment, or null.
// Handles leading VAR=value assignments and git's global options.
export function parseGit(segment) {
       const tokens = segment.match(/"(?:[^"\\]|\\.)*"|'[^']*'|\S+/g) || [];
       let i = 0;
       const env = [];
       while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) env.push(tokens[i++]);
       if (tokens[i] === 'command' || tokens[i] === 'env') i++;
       while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) env.push(tokens[i++]);
       if (!tokens[i] || !/(^|\/)git$/.test(tokens[i])) return null;
       i++;
       const globals = [];
       while (i < tokens.length && tokens[i].startsWith('-')) {
              const t = tokens[i++];
              globals.push(t);
              if ((t === '-c' || t === '-C' || t === '--git-dir' || t === '--work-tree') && i < tokens.length) globals.push(tokens[i++]);
       }
       const sub = tokens[i];
       const args = tokens.slice(i + 1).map(unquote);
       return { env, globals: globals.map(unquote), sub, args };
}

export function check(rawCommand, isAiNotesIgnored = () => true) {
       const command = stripMessages(rawCommand);

       if (/\bHUSKY=0\b/.test(command) || /\bHUSKY_SKIP_HOOKS=/.test(command)) {
              return 'HUSKY=0 disables the commit hooks (D-059). Run the commit normally and fix whatever the hook reports.';
       }
       if (/core\.hooksPath/i.test(command)) {
              return 'Changing core.hooksPath bypasses the commit hooks (D-059). Leave git hook configuration alone.';
       }

       for (const seg of segments(command)) {
              const git = parseGit(seg);
              if (!git) continue;
              const { sub, args } = git;

              if (sub === 'commit') {
                     for (const a of args) {
                            if (a === '--') break;
                            if (a === '--no-verify') {
                                   return 'git commit --no-verify is not allowed: the commit-msg and pre-commit hooks must run (D-059). Fix what the hook reports and commit again.';
                            }
                            if (/^-[A-Za-z]+$/.test(a) && !a.startsWith('-u') && a.includes('n')) {
                                   return `git commit ${a} includes -n (--no-verify), which skips the commit hooks (D-059). Commit without it.`;
                            }
                            if (a === '--amend') {
                                   return 'git commit --amend rewrites history, and the history is graded (D-008). Make a new commit instead; if the last commit is wrong, say so with BLOCKED: and ask.';
                            }
                     }
              }

              if (sub === 'add' || sub === 'stage') {
                     for (const a of args) {
                            if (a === '-f' || a === '--force' || /^-[A-Za-z]*f[A-Za-z]*$/.test(a)) {
                                   return 'git add --force stages ignored files (.ai-notes/, .env, *.db). Stage explicit, non-ignored paths only (D-007).';
                            }
                            if (/(^|\/)\.ai-notes(\/|$)/.test(a)) {
                                   return '.ai-notes/ is git-ignored and is committed once, by hand, at the end (D-007). Do not stage it.';
                            }
                     }
              }

              if ((sub === 'add' || sub === 'stage' || sub === 'commit') && !isAiNotesIgnored()) {
                     return '.ai-notes/ exists but is not git-ignored. Add ".ai-notes/" to .gitignore in its own chore commit before staging anything else (D-007).';
              }

              if (sub === 'push') {
                     for (const a of args) {
                            if (a === '--force' || a === '--force-with-lease' || a.startsWith('--force-with-lease=') || a === '--force-if-includes' || /^-[A-Za-z]*f[A-Za-z]*$/.test(a) || /^\+/.test(a)) {
                                   return 'Force pushes rewrite graded history (D-008, D-057). Push normally; if the push is rejected, stop and ask with BLOCKED:.';
                            }
                     }
              }
       }
       return null;
}

function aiNotesIgnored(cwd) {
       // Exit 0 = ignored, 1 = not ignored, 128 = not a git repo (nothing to protect yet).
       const r = spawnSync('git', ['check-ignore', '-q', '.ai-notes/probe'], { cwd, encoding: 'utf8' });
       return r.status !== 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
       const input = readInput();
       const command = input?.tool_input?.command;
       if (typeof command !== 'string') process.exit(0);
       const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
       const reason = check(command, () => aiNotesIgnored(cwd));
       if (reason) deny(reason);
       process.exit(0);
}
