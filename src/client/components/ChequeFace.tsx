import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { PT_MM, splitWords, type TemplateShape } from "@/shared/layout";

export interface ChequeText {
  date: string;
  payee: string;
  words: string;
  figures: string;
  memo: string;
  crossed: boolean;
}

const round = (v: number) => String(Math.round(v * 100) / 100);

/**
 * The cheque's field text where the template puts it. `preview` scales the
 * leaf to its container at its true proportions; `print` lays it out in mm,
 * shifted by the person's printer offset.
 */
function Fields({
  template,
  text,
  mode,
  offset,
}: {
  template: TemplateShape;
  text: ChequeText;
  mode: "preview" | "print";
  offset: { x: number; y: number };
}) {
  const { layout, widthMm, heightMm } = template;
  const [line1, line2] = splitWords(text.words, layout);
  const place = (
    x: number,
    y: number,
    w?: number,
  ): { style: CSSProperties; data: Record<string, string> } => {
    const px = x + offset.x;
    const py = y + offset.y;
    const style: CSSProperties =
      mode === "print"
        ? { left: `${px}mm`, top: `${py}mm`, width: w ? `${w}mm` : undefined }
        : {
            left: `${(px / widthMm) * 100}%`,
            top: `${(py / heightMm) * 100}%`,
            width: w ? `${(w / widthMm) * 100}%` : undefined,
          };
    return { style, data: { "data-x-mm": round(px), "data-y-mm": round(py) } };
  };
  const field = (
    testId: string,
    x: number,
    y: number,
    children: ReactNode,
    w?: number,
    extra?: string,
  ) => {
    const { style, data } = place(x, y, w);
    return (
      <div
        data-testid={testId}
        {...data}
        dir="auto"
        className={cn(
          "absolute leading-none whitespace-nowrap",
          w && "overflow-hidden text-ellipsis",
          extra,
        )}
        style={style}
      >
        {children}
      </div>
    );
  };
  return (
    <>
      {field("field-date", layout.date.x, layout.date.y, text.date)}
      {field(
        "field-payee",
        layout.payee.x,
        layout.payee.y,
        text.payee,
        layout.payee.w,
      )}
      {field(
        "field-words",
        layout.words.x,
        layout.words.y,
        line1,
        layout.words.w,
      )}
      {line2
        ? field(
            "field-words-2",
            layout.words.x2,
            layout.words.y2,
            line2,
            layout.words.w,
          )
        : null}
      {field("field-figures", layout.figures.x, layout.figures.y, text.figures)}
      {text.memo
        ? field("field-memo", layout.memo.x, layout.memo.y, text.memo)
        : null}
      {text.crossed
        ? field(
            "field-crossing",
            layout.crossing.x,
            layout.crossing.y,
            "A/C payee only",
            undefined,
            "-rotate-12 border-y-2 border-foreground px-2 py-1 font-semibold uppercase",
          )
        : null}
    </>
  );
}

/** The cheque on screen at its true proportions. */
export function ChequePreview({
  template,
  text,
  className,
}: {
  template: TemplateShape;
  text: ChequeText;
  className?: string;
}) {
  const fontSize = `${((template.layout.fontSizePt * PT_MM) / template.widthMm) * 100}cqw`;
  return (
    <div
      data-testid="cheque-preview"
      data-width-mm={template.widthMm}
      data-height-mm={template.heightMm}
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-border bg-card text-foreground shadow-xs",
        className,
      )}
      style={{
        aspectRatio: `${template.widthMm} / ${template.heightMm}`,
        containerType: "inline-size",
      }}
    >
      <div className="absolute inset-0" style={{ fontSize }}>
        <Fields
          template={template}
          text={text}
          mode="preview"
          offset={{ x: 0, y: 0 }}
        />
      </div>
    </div>
  );
}

/**
 * What the printer gets: a page the size of the leaf with only the field
 * text, moved by the person's offset. Hidden on screen; when printing,
 * everything else is hidden (src/client/styles/app.css).
 */
export function PrintSheet({
  template,
  text,
  offset,
}: {
  template: TemplateShape;
  text: ChequeText;
  offset: { x: number; y: number };
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      data-print-sheet
      data-theme="openseo"
      data-testid="print-sheet"
      data-width-mm={template.widthMm}
      data-height-mm={template.heightMm}
      className="relative hidden overflow-hidden text-foreground print:block"
      style={{
        width: `${template.widthMm}mm`,
        height: `${template.heightMm}mm`,
        fontSize: `${template.layout.fontSizePt}pt`,
      }}
    >
      <style>{`@page { size: ${template.widthMm}mm ${template.heightMm}mm; margin: 0; }`}</style>
      <Fields template={template} text={text} mode="print" offset={offset} />
    </div>,
    document.body,
  );
}
