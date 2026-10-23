import { describe, expect, it } from "vitest";
import { argon2Passwords, hashPassword } from "./passwords";

// The real argon2: what `pnpm db:admin`, the seed and the password change store.
describe("argon2Passwords", () => {
  it("hashes with argon2id and verifies only the right password", async () => {
    const hash = await argon2Passwords.hash("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(
      await argon2Passwords.verify(hash, "correct horse battery staple"),
    ).toBe(true);
    expect(await argon2Passwords.verify(hash, "wrong")).toBe(false);
  });

  it("never matches the dummy hash, or a malformed one", async () => {
    expect(await argon2Passwords.verify(argon2Passwords.dummyHash, "")).toBe(
      false,
    );
    expect(await argon2Passwords.verify("not a hash", "anything")).toBe(false);
  });

  it("hashPassword gives a new salt each time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
});
