# Guest vs signed-in state policy

This app intentionally separates guest access from authenticated account features.

## Guest rules

- Guests may open the landing page, login page, signup page, and typing page.
- Guests may type a session without saving results to a user account.
- Guests may browse course/lesson text but cannot permanently mark lessons complete.
- Guests cannot access the dashboard, account settings, or private export endpoints.
- If a guest hits a protected route, the app should redirect to the login page or show a clear auth error.

## Signed-in rules

- Signed-in users can save typing results, view their dashboard, and export their data.
- Signed-in users can manage account settings and change their password.
- Signed-in users can persist learning progress and complete lessons.
- A session expiry should be surfaced as a clear message such as: "Signed out — session expired." rather than a silent redirect.

## Page-level expectations

- `/` — available to everyone.
- `/type.html` — available to everyone; guest results are ephemeral.
- `/dashboard.html` — requires login; redirect to `/login.html` if not authenticated.
- `/settings.html` — requires login.
- `/course.html` and `/lesson.html` — available to guests for reading, but progress save requires login.

## Failure behavior

- No page should render a half-authenticated state.
- Missing authentication should trigger a redirect or a clean empty-state panel.
- Expired sessions should clear the cookie and reload with a readable session message rather than breaking the UI.
