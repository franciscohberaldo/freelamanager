/**
 * Where everything sits on the invoice.
 *
 * The design was drawn on A3 (841 × 1190 pt) and is emitted on A4, which is the same shape
 * at 1/√2 the size, so every position is the model's own coordinate put through one
 * conversion rather than a number someone eyeballed. Keeping the model's numbers in the
 * source means a future tweak can be read straight off the design file.
 *
 * Coordinates were read off the model PDF itself (260914_Buck Invoice 02, revised with the
 * two payment sections). The model measures y from the bottom; `fromBottom` flips it,
 * because drawing does not.
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
  label:       x(81),      // section headings and the client block, left column
  mid:         x(230),     // purchase-order value
  right:       x(459),     // the sender's block
  bank:        x(297),     // bank details, first column
  bankWide:    x(333),     // bank details, indented column
  itemDesc:    x(153),
  itemAmount:  x(441),
  totalAmount: x(410),
  edge:        x(780),     // right margin
} as const

export const Y = {
  date:        fromBottom(1121),  // city-date stamp, top left
  header:      fromBottom(1039),  // BILLED TO / RECIPIENT INFO
  purchase:    fromBottom(940),
  service:     fromBottom(923),
  serviceValue:fromBottom(907),   // the service named under SERVICE ORDERED
  itemsStart:  fromBottom(860),
  rule:        fromBottom(811),
  total:       fromBottom(794),
  paymentTitle:fromBottom(390),   // INTERNATIONAL PAYMENT
  payment:     fromBottom(361),   // PAYMENT INSTRUCTIONS / Wire transfer only
  intermediary:fromBottom(347),
  aba:         fromBottom(333),
  account:     fromBottom(318),
  bankName:    fromBottom(304),
  destination: fromBottom(275),
  beneficiaryBank: fromBottom(261),
  beneficiary: fromBottom(232),
  iban:        fromBottom(217),
  additional:  fromBottom(189),
  additional2: fromBottom(174),
  brTitle:     fromBottom(131),   // BRAZILIAN PAYMENT
  pix:         fromBottom(102),
  brBank:      fromBottom(88),    // Banco, Agência, Conta
} as const

/** One text line to the next, from the model's own line spacing. */
export const ROW = fromBottom(843.8) - fromBottom(860.4)

/** The monogram opens the page at the top right. */
export const LOGO_W = x(59.7)
export const LOGO_H = LOGO_W * (322 / 235)
export const LOGO_TOP = ((MODEL_H - 1057.6 - 81.8) / MODEL_H) * PAGE_H

/** Ink: black for the labels, a softer grey for the figures, as in the model. */
export const INK = { label: [0, 0, 0], figure: [33, 33, 33] } as const
