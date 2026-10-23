import { existsSync } from "node:fs";

/**
 * For the db scripts. Loads `--env-file <path>` if given, otherwise `.env.local` when
 * DATABASE_URL isn't already set. Returns the URL and prints where it points, without the password.
 */
export function loadDatabaseUrl(argv = process.argv.slice(2)): string {
  const flag = argv.indexOf("--env-file");
  const envFile = flag === -1 ? undefined : argv[flag + 1];

  if (flag !== -1 && !envFile) fail("--env-file needs a path.");
  if (envFile) {
    if (!existsSync(envFile)) fail(`${envFile} doesn't exist.`);
    process.loadEnvFile(envFile);
  } else if (!process.env.DATABASE_URL && existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    fail(
      "DATABASE_URL is not set. Add it to .env.local or pass --env-file <path>.",
    );
  }
  console.log(`Database: ${describeDatabaseUrl(url)}`);
  return url;
}

/** "host/database", for logs. Never includes the user or password. */
export function describeDatabaseUrl(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/**
 * The underlying database error, without the failed query's parameters
 * (which can include a password hash).
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  return cause instanceof Error ? cause.message : error.message;
}
