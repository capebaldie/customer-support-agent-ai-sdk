// Validates required env vars once, before the server accepts any request.
// Without this, lib/env.ts would only run when some route happens to import it.
export async function register() {
  await import("./lib/env");
}
