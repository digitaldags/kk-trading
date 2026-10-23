import { describe, expect, it } from "vitest";
import { MAX_PRICE_CENTAVOS, parsePriceToCentavos } from "./price";

describe("parsePriceToCentavos", () => {
  it.each([
    ["8950", 895000],
    ["8,950", 895000],
    ["₱8,950.50", 895050],
    ["₱ 8,950.5", 895050],
    [" 12.5 ", 1250],
    ["0", 0],
    ["0.99", 99],
    [8950, 895000],
    [8950.5, 895050],
  ])("reads %j as %i centavos", (input, centavos) => {
    expect(parsePriceToCentavos(input)).toBe(centavos);
  });

  it.each(["", "  ", "-1", "abc", "1.234", "1.2.3", "₱", "1e3", "12abc", -5])(
    "rejects %j",
    (input) => {
      expect(parsePriceToCentavos(input)).toBeNull();
    },
  );

  it("rejects prices that don't fit the database column", () => {
    expect(
      parsePriceToCentavos(String(MAX_PRICE_CENTAVOS / 100)),
    ).not.toBeNull();
    expect(parsePriceToCentavos("21474837")).toBeNull();
    expect(parsePriceToCentavos("99999999999999999999")).toBeNull();
  });
});
