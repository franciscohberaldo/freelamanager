import type jsPDF from "jspdf"
import { JOST_BOOK } from "./jost-book"
import { JOST_BOOK_ITALIC } from "./jost-book-italic"
import { JOST_BOLD } from "./jost-bold"
import { JOST_HEAVY } from "./jost-heavy"

/**
 * Jost is the invoice's voice: the design leans on the jump from Book to Heavy for its
 * section headings, which a substituted font loses. jsPDF ships only the PDF base fonts,
 * so the four weights the layout uses are carried in the bundle and registered per
 * document. This only ever runs on the server, in the two PDF routes, so the weight costs
 * the browser nothing.
 */
export const JOST = "Jost"

/** The style names jsPDF is asked for; "heavy" is registered as its own style. */
export type JostStyle = "normal" | "italic" | "bold" | "heavy"

const FILES: { file: string; style: JostStyle; data: string }[] = [
  { file: "Jost-Book.ttf",       style: "normal", data: JOST_BOOK },
  { file: "Jost-BookItalic.ttf", style: "italic", data: JOST_BOOK_ITALIC },
  { file: "Jost-Bold.ttf",       style: "bold",   data: JOST_BOLD },
  { file: "Jost-Heavy.ttf",      style: "heavy",  data: JOST_HEAVY },
]

export function registerJost(doc: jsPDF): void {
  for (const { file, style, data } of FILES) {
    doc.addFileToVFS(file, data)
    doc.addFont(file, JOST, style)
  }
}
