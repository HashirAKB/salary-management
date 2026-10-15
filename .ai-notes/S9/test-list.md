# S9 test list

## Cycle A: waking banner (05 5.9 C rows 2, 3)
[x] C  a request pending over 4 seconds shows the waking banner (manual scheduler)  (05 §5.9 C row 2)
[x] C  a non-JSON response, a bare 502/503/504 or a network error to /api shows the waking banner (it.each)  (05 §5.9 C row 3; 04 §8.3)
[x] C  a 503 with a problem+json body is an ApiError and does not show the waking banner  (04 §8.3 "without application/problem+json")

## Cycle B: health poll and GET retry (05 5.9 C rows 3, 4)
[x] C  a 200 health response hides the banner and the failed GET is retried once  (05 §5.9 C row 3)
[x] C  a write that hits a waking server is not retried and shows the "may not have been saved" message  (05 §5.9 C row 4)
[x] U  the query client never retries a ServerWakingError  (04 §8.3 "the waking logic owns transport retries")

## Cycle C: server down (05 5.9 C row 5)
[x] C  after 90 seconds of failed polls the banner says the server isn't responding, with "Try again"  (05 §5.9 C row 5)
[x] C  "Try again" restarts the health poll and a 200 hides the banner  (04 §8.2 Server down row)

## Cycle D: smoke test (05 5.10)
[-] C  CUT by A-011 (docs/decisions.md): log in, filter, record a raise and see the role differences  (05 §5.10 steps 1-5)
