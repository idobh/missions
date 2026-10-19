// Edge + Node compatible session token: HMAC-SHA256 of a fixed label keyed by APP_PASSWORD.
// Changing APP_PASSWORD invalidates every existing session.
export const SESSION_COOKIE = "missions_session";

export async function sessionToken(password = process.env.APP_PASSWORD || ""): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("missions-session-v1"));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token || !process.env.APP_PASSWORD) return false;
  const expected = await sessionToken();
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
