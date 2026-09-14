import { describe, it, expect } from "vitest"
import { reorder, mergeColumnOrder } from "@/lib/column-order"

describe("reorder", () => {
  it("moves an item forward", () => {
    expect(reorder(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"])
  })

  it("moves an item backward", () => {
    expect(reorder(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"])
  })

  it("changes nothing when dropped on itself", () => {
    expect(reorder(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"])
  })

  it("leaves the original array untouched", () => {
    const original = ["a", "b", "c"]
    reorder(original, 0, 2)
    expect(original).toEqual(["a", "b", "c"])
  })

  it("ignores an index outside the list", () => {
    expect(reorder(["a", "b"], 5, 0)).toEqual(["a", "b"])
    expect(reorder(["a", "b"], 0, 9)).toEqual(["a", "b"])
    expect(reorder(["a", "b"], -1, 0)).toEqual(["a", "b"])
  })
})

describe("mergeColumnOrder", () => {
  const defaults = ["tomador", "marca", "job", "total"]

  it("falls back to the default order when nothing was saved", () => {
    expect(mergeColumnOrder(null, defaults)).toEqual(defaults)
  })

  it("keeps the order the user arranged", () => {
    expect(mergeColumnOrder(["job", "total", "tomador", "marca"], defaults))
      .toEqual(["job", "total", "tomador", "marca"])
  })

  it("drops a column that no longer exists", () => {
    expect(mergeColumnOrder(["job", "obsoleta", "tomador", "marca", "total"], defaults))
      .toEqual(["job", "tomador", "marca", "total"])
  })

  it("appends a column added after the order was saved", () => {
    expect(mergeColumnOrder(["job", "tomador"], defaults))
      .toEqual(["job", "tomador", "marca", "total"])
  })

  it("ignores a duplicated entry", () => {
    expect(mergeColumnOrder(["job", "job", "tomador"], defaults))
      .toEqual(["job", "tomador", "marca", "total"])
  })

  it("falls back to the default order when the saved value is not a list of strings", () => {
    expect(mergeColumnOrder("job,total" as unknown as string[], defaults)).toEqual(defaults)
    expect(mergeColumnOrder([1, 2] as unknown as string[], defaults)).toEqual(defaults)
    expect(mergeColumnOrder([], defaults)).toEqual(defaults)
  })
})
