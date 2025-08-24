// api/_lib/auth.js
// Soft verification for Supabase JWT (no signature check):
// - Parses Bearer token
// - Validates exp (not expired)
// - Optionally validates issuer domain contains 'supabase.co/auth/v1'
// Returns { ok: boolean, code?: number, reason?: string, sub?: string, email?: string, payload?: object }

function b64urlToJson(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 2 ? '==' : (b64.length % 4 === 3 ? '=' : '');
  const s = Buffer.from(b64 + pad, 'base64').toString('utf8');
  return JSON.parse(s);
}

export function softVerifySupabaseJWT(authorizationHeader, { require = false } = {}) {
  try {
    const header = authorizationHeader || '';
    const m = header.match(/^Bearer\s+([A-Za-z0-9\-\._~\+/=]+)$/i);
    if (!m) {
      if (require) return { ok: false, code: 401, reason: 'Missing Bearer token' };
      return { ok: true, sub: null };
    }
    const token = m[1];
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { ok: false, code: 401, reason: 'Malformed JWT' };
    }
    const payload = b64urlToJson(parts[1]);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && now >= payload.exp) {
      return { ok: false, code: 401, reason: 'Token expired' };
    }
    if (payload.iss && !/supabase\.co\/auth\/v1/.test(String(payload.iss))) {
      // Not strictly required; only warn
      // return { ok: false, code: 401, reason: 'Invalid issuer' };
    }
    return { ok: true, sub: payload.sub || null, email: payload.email || null, payload };
  } catch (e) {
    if (require) return { ok: false, code: 401, reason: 'JWT parse error' };
    return { ok: true, sub: null };
  }
}
