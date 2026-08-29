import { describe, expect, test } from "bun:test";
import { clampWeight, computeScore, DEFAULT_WEIGHTS } from "../src/magnitude";

describe("clampWeight", () => {
  test("clamps 0.5-2", () => { expect(clampWeight(0.1)).toBe(0.5); expect(clampWeight(3)).toBe(2); expect(clampWeight(1.2)).toBe(1.2); });
});
describe("computeScore", () => {
  test("sums points*weight, floors at 0", () => {
    expect(computeScore([{ category: "post", points: 2, weight: 1 }, { category: "post", points: 2, weight: 1.5 }])).toBe(5);
    expect(computeScore([{ category: "post", points: -10, weight: 1 }])).toBe(0);
  });
  test("defaults exist", () => { expect(DEFAULT_WEIGHTS.post).toBe(1); });
});
