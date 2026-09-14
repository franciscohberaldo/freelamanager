/**
 * Where everything sits on the invoice.
 *
 * The design was drawn on A3 (841 × 1190 pt) and is emitted on A4, which is the same shape
 * at 1/√2 the size, so every position is the model's own coordinate put through one
 * conversion rather than a number someone eyeballed. Keeping the model's numbers in the
 * source means a future tweak can be read straight off the design file.
 *
 * The model measures y from the bottom; `fromBottom` flips it, because drawing does not.
 */
const MODEL_W = 841
const MODEL_H = 1190

export const PAGE_W = 210
export const PAGE_H = 297

const x = (modelX: number) => (modelX / MODEL_W) * PAGE_W
const fromBottom = (modelY: number) => ((MODEL_H - modelY) / MODEL_H) * PAGE_H

/**
 * The model sets 16pt inside a group scaled by 0.75, so it renders at 12pt on A3 — 8.5pt
 * once the page shrinks to A4.
 */
export const BODY_PT = 8.5
export const TOTAL_PT = 9.5

export const X = {
  label:       x(86),      // section headings, left column
  mid:         x(230),     // the client's block
  right:       x(459),     // the sender's block
  bank:        x(302),     // bank details, first column
  bankWide:    x(338),     // bank details, indented column
  itemDesc:    x(158),
  itemAmount:  x(446),
  totalAmount: x(410),
  logo:        x(79),
  edge:        x(780),     // right margin
} as const

export const Y = {
  date:        fromBottom(1084),
  header:      fromBottom(975),
  line2:       fromBottom(959),
  line3:       fromBottom(942),
  line4:       fromBottom(925),
  line5:       fromBottom(909),
  purchase:    fromBottom(892),
  service:     fromBottom(876),
  itemsStart:  fromBottom(812),
  rule:        fromBottom(762),
  total:       fromBottom(745),
  payment:     fromBottom(254),
  intermediary:fromBottom(240),
  aba:         fromBottom(225),
  account:     fromBottom(211),
  bankName:    fromBottom(197),
  destination: fromBottom(168),
  beneficiaryBank: fromBottom(153),
  beneficiary: fromBottom(125),
  iban:        fromBottom(110),
  additional:  fromBottom(81),
  additional2: fromBottom(67),
  logo:        fromBottom(158),
} as const

/** One item row to the next, from the three rows in the model. */
export const ROW = fromBottom(795) - fromBottom(812)

export const LOGO_W = x(82)
export const LOGO_H = ((322 / 235) * 82 / MODEL_W) * PAGE_W

/** Ink: black for the labels, a softer grey for the figures, as in the model. */
export const INK = { label: [0, 0, 0], figure: [33, 33, 33] } as const
