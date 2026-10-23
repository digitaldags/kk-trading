import { describe, expect, it } from "vitest";
import { formatPeso } from "@/lib/format";

describe("formatPeso", () => {
  it.each([
    [895000, "₱8,950"],
    [895050, "₱8,950.50"],
    [0, "₱0"],
    [5, "₱0.05"],
    [123456789, "₱1,234,567.89"],
  ])("formats %i centavos as %s", (centavos, expected) => {
    expect(formatPeso(centavos)).toBe(expected);
  });
});
