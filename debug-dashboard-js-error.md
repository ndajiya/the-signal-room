# Debug Session: dashboard-js-error

- Status: OPEN
- Started: 2026-06-10
- Symptom: Admin dashboard loads but browser throws `SyntaxError: Invalid or unexpected token`, then `ReferenceError: loadSettings is not defined`.
- Expected: Dashboard script parses successfully and clicking `Login` calls `loadSettings()`.

## Hypotheses

1. The HTML response still contains an unescaped token inside the inline `<script>` block, so parsing stops before `loadSettings()` is declared.
2. A server-side template literal in `api/admin/dashboard.ts` is interpolating JavaScript placeholders too early, producing broken client-side code.
3. The browser is receiving stale or partially compiled dashboard output from the dev server, despite the source file looking correct on disk.
4. Another route wrapper or transform in `dev-server.ts` is altering the dashboard response content before it reaches the browser.
5. The runtime error comes from a specific line in the emitted HTML that differs from the TypeScript source, so the real bug is only visible in the served response.

## Evidence Log

- Captured the served HTML from `/api/admin/dashboard` and extracted the inline script.
- Added temporary instrumentation in `api/admin/dashboard.ts` to report emitted HTML shape to the debug server.
- Debug event showed:
  - `hasEscapedBackticks: false`
  - `hasEscapedInterpolations: false`
  - `hasClientLoadSettings: true`
- `node --check tmp-dashboard-script.js` failed before the fix at the alert line for Supabase success.
- The emitted script contained a literal newline inside a single-quoted JS string:
  - `alert('Supabase configuration saved successfully! ...`
  - followed by a real newline before `Your settings will now be stored in the database.')`
- Root cause: `\n\n` in the outer TypeScript template literal was converted into literal newlines in the browser script, causing parse failure before `loadSettings()` was defined.
- Applied minimal fix: changed the alert text to use `\\n\\n` so the emitted browser script stays syntactically valid.
- `node --check tmp-dashboard-script.js` passes after the fix.

## Next Step

- Ask the user to refresh and confirm whether the dashboard now moves past the configuration screen.
