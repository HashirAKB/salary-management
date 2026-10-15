
## Session B1 done (cycles S10 A-C)
Last commit: 3968438 docs(db): record query timings at 10000 employees
Open rows: row 6 (decisions.md D-020 row still names 00-brief-analysis.md as a superseded record; user to decide); no em dash in README (README not written yet); README links; fresh clone; full suite and coverage; live smoke; video rows.
Notes: A needed the user to run git rm by hand (classifier denied it). Commits: 71aa535, 656ca8e, 187e356, 34bd3d4 (removed the company name from D-020, user request: no incubyte reference anywhere in the repo; keep that true in README), 927d833 perf script, 3968438 performance.md. Perf rows are 10,250 employees (10,000 active). docs/06-build-plan.md still mentions "00" by section only (no filename); left as is. README must not name the hiring company.

## Session B2 done (cycles S10 D)
Last commit: 18ccf35 docs: add readme with setup, demo accounts and design links
Open rows: README links, em dash check (README clean now, recheck at finish), fresh clone, full suite, live smoke, video rows, D-020 row in decisions.md.
Notes: README has a video placeholder ("link added at the end of the build") for cycle F. It links .ai-notes/ (resolves only after the user's hand commit). Demo passwords are printed per P11. S8 and S9 entries drafted in .ai-notes/log.md (unstaged, review.md files were empty so reviewer and test counts are TODO). Next: /tdd-build S10 E-F.

## Session B3 done (cycles S10 E-F)
Last commit: 18ccf35 docs: add readme with setup, demo accounts and design links (no commits this session; the demo workspace is outside the repo, P2)
Open rows: video length row (final.mp4 is 2:57, target 3-5 min; narration sets the length, user decides whether to add a line); F not done: README video embed and the docs: link the demo video commit, waiting for the user to upload final.mp4 (GitHub user-attachments URL) and the YouTube fallback URL; README links, fresh clone, full suite and coverage, live smoke, em dash grep (all /tdd-finish).
Notes: Workspace ../salary-management-demo (10 scenes, user-approved richer narration covering all 3 roles, product reasoning, Ask). Output ../salary-management-demo/out/final.mp4. No seed run (user: existing data is fine); test takes recorded merit raises on the first filtered India L3 employee (Anjaneya Abbott), so that employee has 3 extra 5% merit rows dated 2026-10-11; npm run seed restores. Old sample workspace ../acme-demo-video left untouched (not part of this build). Login page has no demo-accounts box (04 section 8.1 lists one); not shown in the video, flag at finish. One flaky full npm test run (8 web timeouts) came from two runs overlapping; web project passes alone (145 tests). Shell quirk: cat is aliased to a missing batcat, use Read/Write tools.

Update: user uploaded the detailed take (4:50) to YouTube; README links it (0bf4fd6). GitHub-hosted embed still open, waiting for the user-attachments URL.
