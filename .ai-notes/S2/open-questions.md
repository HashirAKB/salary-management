# S2 open questions

1. Background security review on 7603fd3: with `trustProxy: true` (04 §4.1, 06 S2 scope), Fastify takes the left-most X-Forwarded-For entry as `request.ip`, which the client controls, so rotating that header bypasses the login rate limit. `trustProxy: 1` (trust Render's one hop) would use the address Render appends. The docs name `true` explicitly, so this is a spec change: raise with the user at the end of the slice.
Resolved: fixed in a55d3f4 (red) and 535e0bf (green) after the user said "Do what you think the best" (overrides.md item 5). 04 §4.1 and 06 S2 still say `trustProxy: true` and need a docs update.
