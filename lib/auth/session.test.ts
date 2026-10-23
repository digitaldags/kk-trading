import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "./session";

const SECRET = "test-secret-that-is-at-least-32-bytes-long";
const CLAIMS = {
  sub: "00000000-0000-4000-8000-000000000001",
  pwd: 1_790_000_000_000,
};

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("session tokens", () => {
  it("round-trips the admin id, password time and issue time", async () => {
    const token = await signSession(CLAIMS);
    expect(await verifySession(token)).toEqual({
      ...CLAIMS,
      iat: expect.any(Number),
    });
  });

  it("rejects a missing, tampered or garbage token", async () => {
    const token = await signSession(CLAIMS);
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...CLAIMS, sub: "someone-else", iat: 1, exp: 9e9 }),
    ).toString("base64url");

    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession("not.a.jwt")).toBeNull();
    expect(await verifySession(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession(CLAIMS);
    vi.stubEnv(
      "SESSION_SECRET",
      "another-secret-that-is-also-32-bytes-or-more",
    );
    expect(await verifySession(token)).toBeNull();
  });

  it("rejects a token after 7 days", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T00:00:00Z") });
    const token = await signSession(CLAIMS);
    vi.setSystemTime(Date.now() + (SESSION_MAX_AGE_SECONDS - 60) * 1000);
    expect(await verifySession(token)).not.toBeNull();
    vi.setSystemTime(Date.now() + 120 * 1000);
    expect(await verifySession(token)).toBeNull();
  });

  it("rejects a valid signature with the wrong claims or algorithm", async () => {
    const secret = new TextEncoder().encode(SECRET);
    const noPwd = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(CLAIMS.sub)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
    const hs512 = await new SignJWT({ pwd: CLAIMS.pwd })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(CLAIMS.sub)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
    expect(await verifySession(noPwd)).toBeNull();
    expect(await verifySession(hs512)).toBeNull();
  });

  it("refuses to sign or verify with a secret under 32 bytes", async () => {
    vi.stubEnv("SESSION_SECRET", "too-short");
    await expect(signSession(CLAIMS)).rejects.toThrow(
      "SESSION_SECRET must be at least 32 bytes",
    );
    await expect(verifySession("a.b.c")).rejects.toThrow(
      "SESSION_SECRET must be at least 32 bytes",
    );
  });
});

describe("session cookie", () => {
  it("is HttpOnly, Secure, SameSite=Lax, site-wide and lasts 7 days", () => {
    expect(sessionCookieOptions).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  });
});
