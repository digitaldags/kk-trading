import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatDocumentDate,
  formatPeso,
  formatPesoExact,
  formatSavedAt,
  formatShortDocumentDate,
} from "@/lib/format";

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

describe("formatAmount", () => {
  it.each([
    [845000, "8,450.00"],
    [845050, "8,450.50"],
    [0, "0.00"],
    [10257500, "102,575.00"],
  ])("formats %i centavos as %s", (centavos, expected) => {
    expect(formatAmount(centavos)).toBe(expected);
  });
});

describe("formatPesoExact", () => {
  it.each([
    [10257500, "₱102,575.00"],
    [895000, "₱8,950.00"],
    [5, "₱0.05"],
  ])("formats %i centavos as %s", (centavos, expected) => {
    expect(formatPesoExact(centavos)).toBe(expected);
  });
});

describe("formatDocumentDate", () => {
  it.each([
    ["2026-10-27", "October 27, 2026"],
    ["2026-01-01", "January 1, 2026"],
    ["2026-12-31", "December 31, 2026"],
  ])("formats %s as %s", (date, expected) => {
    expect(formatDocumentDate(date)).toBe(expected);
  });
});

describe("formatShortDocumentDate", () => {
  it.each([
    ["2026-10-27", "Oct 27, 2026"],
    ["2026-01-01", "Jan 1, 2026"],
    ["2026-12-31", "Dec 31, 2026"],
  ])("formats %s as %s", (date, expected) => {
    expect(formatShortDocumentDate(date)).toBe(expected);
  });
});

describe("formatSavedAt", () => {
  it("shows the date and time in Manila", () => {
    // 07:42 UTC is 3:42 PM in Manila (UTC+8).
    expect(formatSavedAt(new Date("2026-10-27T07:42:00Z"))).toBe(
      "Oct 27, 2026, 3:42 PM",
    );
    // Still the 27th in UTC, already the 28th in Manila.
    expect(formatSavedAt(new Date("2026-10-27T16:05:00Z"))).toBe(
      "Oct 28, 2026, 12:05 AM",
    );
  });
});
