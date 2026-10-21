import { beforeEach, describe, expect, it } from "vitest";
import {
  createAuthService,
  TOO_MANY_ATTEMPTS,
  WRONG_CREDENTIALS,
  type PasswordVerifier,
} from "./authService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

// A stand-in for argon2: a "hash" is the password with a prefix. Records each check, so
// the tests can see an unknown email still runs one.
function fakePasswords() {
  const checked: string[] = [];
  const passwords: PasswordVerifier & { checked: string[] } = {
    checked,
    dummyHash: "hash:dummy",
    async verify(hash, password) {
      checked.push(hash);
      return hash === `hash:${password}`;
    },
  };
  return passwords;
}

const PASSWORD = "correct horse battery staple";
const IP = "203.0.113.7";
const MINUTE = 60 * 1000;

let store: FakeStore;
let passwords: ReturnType<typeof fakePasswords>;
let service: ReturnType<typeof createAuthService>;
let adminId: string;

beforeEach(async () => {
  store = createFakeStore();
  passwords = fakePasswords();
  service = createAuthService({
    admins: store.adminUserRepo,
    attempts: store.loginAttemptRepo,
    passwords,
    now: store.clock.now,
  });
  const admin = await store.adminUserRepo.insert({
    email: "owner@example.com",
    passwordHash: `hash:${PASSWORD}`,
  });
  adminId = admin.id;
});

const signIn = (email: string, password: string, ip = IP) =>
  service.signIn({ email, password }, ip);

async function failTimes(n: number, email = "owner@example.com", ip = IP) {
  for (let i = 0; i < n; i++) await signIn(email, "wrong password", ip);
}

describe("authService.signIn", () => {
  it("returns the session claims and records the success", async () => {
    const result = await signIn(" Owner@Example.com ", PASSWORD);
    expect(result).toEqual({
      ok: true,
      data: { sub: adminId, pwd: expect.any(Number) },
    });
    expect(store.loginAttempts).toEqual([
      expect.objectContaining({
        email: "owner@example.com",
        ip: IP,
        succeeded: true,
      }),
    ]);
  });

  it("gives a wrong password and an unknown email the same error, after a password check", async () => {
    const wrong = await signIn("owner@example.com", "nope");
    const unknown = await signIn("nobody@example.com", PASSWORD);
    expect(wrong).toEqual({
      ok: false,
      fieldErrors: {},
      formError: WRONG_CREDENTIALS,
    });
    expect(unknown).toEqual(wrong);
    // The unknown email is still checked, against the dummy hash, so it takes as long.
    expect(passwords.checked).toEqual([`hash:${PASSWORD}`, "hash:dummy"]);
    expect(store.loginAttempts.map((a) => a.succeeded)).toEqual([false, false]);
  });

  it("rejects the 6th attempt within 15 minutes even with the right password", async () => {
    await failTimes(5);
    const checksBefore = passwords.checked.length;

    const sixth = await signIn("owner@example.com", PASSWORD);
    expect(sixth).toEqual({
      ok: false,
      fieldErrors: {},
      formError: TOO_MANY_ATTEMPTS,
    });
    // Turned away before the password is checked, and not recorded.
    expect(passwords.checked).toHaveLength(checksBefore);
    expect(store.loginAttempts).toHaveLength(5);
  });

  it("lets the admin in again once the failures are 15 minutes old", async () => {
    await failTimes(5);
    store.clock.advance(14 * MINUTE);
    expect((await signIn("owner@example.com", PASSWORD)).ok).toBe(false);

    store.clock.advance(MINUTE + 1);
    expect((await signIn("owner@example.com", PASSWORD)).ok).toBe(true);
  });

  it("doesn't lock the account after 4 failures", async () => {
    await failTimes(4);
    expect((await signIn("owner@example.com", PASSWORD)).ok).toBe(true);
  });

  it("locks an IP after 20 failures across emails", async () => {
    for (let i = 0; i < 20; i++) {
      await signIn(`guess${i}@example.com`, "wrong password");
    }
    expect(await signIn("owner@example.com", PASSWORD)).toEqual({
      ok: false,
      fieldErrors: {},
      formError: TOO_MANY_ATTEMPTS,
    });
    // Another IP is unaffected.
    expect(
      (await signIn("owner@example.com", PASSWORD, "198.51.100.2")).ok,
    ).toBe(true);
  });

  it("asks for both fields", async () => {
    expect(await signIn("  ", "")).toEqual({
      ok: false,
      fieldErrors: {
        email: "Enter your email.",
        password: "Enter your password.",
      },
    });
    expect(store.loginAttempts).toHaveLength(0);
  });

  it("accepts a name that isn't an email address", async () => {
    await store.adminUserRepo.insert({
      email: "admin",
      passwordHash: "hash:admin",
    });
    expect((await signIn("admin", "admin")).ok).toBe(true);
  });
});

describe("authService.getSessionAdmin", () => {
  async function claims() {
    const result = await signIn("owner@example.com", PASSWORD);
    if (!result.ok) throw new Error("sign-in failed");
    return result.data;
  }

  it("returns the admin without the password hash", async () => {
    expect(await service.getSessionAdmin(await claims())).toEqual({
      id: adminId,
      email: "owner@example.com",
    });
  });

  it("rejects a session issued before the password changed", async () => {
    const session = await claims();
    store.clock.advance(1000);
    await store.adminUserRepo.updatePassword(adminId, "hash:new password");
    expect(await service.getSessionAdmin(session)).toBeNull();

    // A session started after the change is fine.
    const fresh = await service.signIn(
      { email: "owner@example.com", password: "new password" },
      IP,
    );
    if (!fresh.ok) throw new Error("sign-in failed");
    expect(await service.getSessionAdmin(fresh.data)).not.toBeNull();
  });

  it("rejects an unknown or malformed admin id", async () => {
    const { pwd } = await claims();
    expect(
      await service.getSessionAdmin({
        sub: "00000000-0000-4000-8000-999999999999",
        pwd,
      }),
    ).toBeNull();
    expect(
      await service.getSessionAdmin({ sub: "not-a-uuid", pwd }),
    ).toBeNull();
  });
});
