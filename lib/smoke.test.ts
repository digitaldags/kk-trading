import { describe, expect, it } from "vitest";

// Placeholder until ticket 02 adds the formatPeso tests.
describe("scaffold", () => {
  it("resolves the @/ path alias", async () => {
    await expect(import("@/lib/format")).resolves.toBeDefined();
  });
});
