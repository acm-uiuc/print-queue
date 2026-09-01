import { describe, expect, it } from "vitest";
import { validatePageRange } from "./pageRange";

describe("validatePageRange", () => {
  it("uses every page when the field is blank", () => {
    expect(validatePageRange("  ", 12)).toEqual({
      error: null,
      normalized: "",
      pageCount: 12,
    });
  });

  it("normalizes valid ranges and counts selected pages", () => {
    expect(validatePageRange(" 1-3, 5, 8-9 ", 10)).toEqual({
      error: null,
      normalized: "1-3,5,8-9",
      pageCount: 6,
    });
  });

  it.each([
    ["0", 10, "start at page 1"],
    ["7-3", 10, "lower page first"],
    ["1-11", 10, "10 pages"],
    ["1-3,3-5", 10, "cannot overlap"],
    ["1,1", 10, "cannot overlap"],
    ["1-", 10, "separated by commas"],
    ["1 2", 20, "separated by commas"],
  ])("rejects invalid range %s", (value, pages, message) => {
    expect(validatePageRange(value, pages).error).toContain(message);
  });
});
