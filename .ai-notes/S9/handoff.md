## Session B1 done (cycles S9 A-C)
Last commit: 2b61e14 feat(web): add server down state with try again
Open rows: Cycle D (smoke test) only
Notes: GET retry lives in apiFetch (user-approved override, see overrides.md). A write that hits a waking server throws ServerWakingError with the "may not have been saved" message, so every form shows it via error.message; only SalaryChangeModal is tested. Non-ok JSON responses with a valid problem body count as ApiError even without the problem+json content type (AskPage test relies on this). ServerStatusBanner is rendered in Shell above the outlet. Run B2 (build(e2e), test(e2e), ci) next.

## Cut 3 applied
Cycle D and B2 skipped by user decision. Next: /tdd-finish S9.
