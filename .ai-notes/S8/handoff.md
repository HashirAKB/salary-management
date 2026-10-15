
## Session B1 done (cycles A-C)
Last commit: 640974d feat(ask): add answer templates
Open rows: none for A-C
Notes: Fixed unrelated EmployeeExport test (f29b647, user-approved). GroupResult gained optional currency and gap (absent on suppressed groups). answer.ts holds describeScope, buildSentence, interpretationList, reasonMessage, genderRuleSuggestion; interpret.ts checkQuery returns cannot_answer with rule 'genderGap'. Grouped sentences end with ':' and carry no suppressed note; E/F should surface it if wanted. formatMoney lives in answer.ts (spec 7.6 needs it in the API sentence).

## Session B3 done (cycles G-H)
Last commit: 5584a7c chore(ask): add eval runner
Open rows: none for G; H is runner only. The first run needs the user with ANTHROPIC_API_KEY and a seeded DB (`npm run eval`), then `docs(ask): record first eval run`.
Notes: AskPage hides the top example chips once an answer exists (they would duplicate the cannot-answer card's examples, which the test queries by text). Reset time uses mutation.submittedAt (no Clock in web). Response parse in features/ask/api.ts is a cast (no shared response zod schema). The report's failure lines carry a TODO cause for the user to fill in.
