export interface AuthDebug {
  hasEnvSecret: boolean;
  envSecretLength: number;
  hasAuthHeader: boolean;
  authHeaderLength: number;
  authStartsWithBearer: boolean;
  tokenLength: number;
  tokenMatches: boolean;
}

export interface AuthResult {
  authorized: boolean;
  debug: AuthDebug;
}

export function validateSyncAuth(request: Request): AuthResult {
  // Trim both sides so stray whitespace / CRLF in .env.local never causes 401
  const envSecret = (process.env.CRON_SECRET ?? "").trim();
  const authHeader = request.headers.get("authorization");
  const startsWithBearer = authHeader?.startsWith("Bearer ") ?? false;
  const token = startsWithBearer
    ? authHeader!.slice("Bearer ".length).trim()
    : "";

  const debug: AuthDebug = {
    hasEnvSecret: envSecret.length > 0,
    envSecretLength: envSecret.length,
    hasAuthHeader: authHeader !== null,
    authHeaderLength: authHeader?.length ?? 0,
    authStartsWithBearer: startsWithBearer,
    tokenLength: token.length,
    tokenMatches: token === envSecret,
  };

  // Require both a non-empty env secret and a matching token
  return {
    authorized: envSecret.length > 0 && token === envSecret,
    debug,
  };
}