import { describe, it, expect } from "vitest"
import { findGaps, findDuplicates, padSeq } from "@/lib/nf-sequence"

describe("findGaps", () => {
  it("returns ranges of missing numbers", () => {
    expect(findGaps(["0100", "0101", "0089", "0079", "0080"])).toEqual([{ from: 81, to: 88 }, { from: 90, to: 99 }])
  })
  it("ignores nulls and junk", () => {
    expect(findGaps(["1", null, "x", "3"])).toEqual([{ from: 2, to: 2 }])
  })
  it("empty when contiguous or fewer than two values", () => {
    expect(findGaps(["5", "6", "7"])).toEqual([])
    expect(findGaps(["5"])).toEqual([])
    expect(findGaps([])).toEqual([])
  })
})

describe("findDuplicates", () => {
  it("normalizes leading zeros", () => {
    expect(findDuplicates(["0089", "89", "0100", null])).toEqual(["89"])
  })
  it("returns each duplicate once, sorted", () => {
    expect(findDuplicates(["7", "7", "7", "3", "3"])).toEqual(["3", "7"])
  })
})

describe("padSeq", () => {
  it("pads to 4 digits", () => {
    expect(padSeq(102)).toBe("0102")
    expect(padSeq(12345)).toBe("12345")
  })
})
