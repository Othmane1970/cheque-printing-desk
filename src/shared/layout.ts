import { z } from "zod";

// Where each field sits on a cheque leaf, in mm from its top-left corner.
const mm = z.number().min(-50).max(400);
const point = z.object({ x: mm, y: mm }).strict();

export const layoutSchema = z
  .object({
    fontSizePt: z.number().min(6).max(24),
    date: point,
    payee: point.extend({ w: z.number().min(10).max(400) }).strict(),
    words: z
      .object({
        x: mm,
        y: mm,
        w: z.number().min(10).max(400),
        lines: z.union([z.literal(1), z.literal(2)]),
        x2: mm,
        y2: mm,
      })
      .strict(),
    figures: point,
    memo: point,
    crossing: point,
  })
  .strict();

export type Layout = z.infer<typeof layoutSchema>;

export interface TemplateShape {
  widthMm: number;
  heightMm: number;
  layout: Layout;
}

export const FIELD_LABELS = {
  date: "Date",
  payee: "Payee",
  words: "Amount in words",
  figures: "Amount in figures",
  memo: "Memo",
  crossing: "Crossing",
} as const;

/** One pt in mm. */
export const PT_MM = 25.4 / 72;

/**
 * Splits the words over two lines when the template has two: as many whole
 * words as fit the first line's width at the template's font size.
 */
export function splitWords(text: string, layout: Layout): [string, string] {
  if (layout.words.lines === 1) return [text, ""];
  const charMm = layout.fontSizePt * PT_MM * 0.5;
  const fits = Math.max(1, Math.floor(layout.words.w / charMm));
  if (text.length <= fits) return [text, ""];
  const cut = text.lastIndexOf(" ", fits);
  const at = cut > 0 ? cut : fits;
  return [text.slice(0, at), text.slice(at).trim()];
}
