import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, Copy, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import {
  ChequePreview,
  PrintSheet,
  type ChequeText,
} from "@/client/components/ChequeFace";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { formatDate, messageOf, today } from "@/client/lib/errors";
import { FIELD_LABELS, type Layout } from "@/shared/layout";
import { amountInWords, CURRENCY_CODES, formatAmount } from "@/shared/money";
import {
  copyTemplate,
  deleteTemplate,
  getTemplate,
  saveOffset,
  updateTemplate,
} from "@/serverFunctions/templates";

export const Route = createFileRoute("/templates/$templateId")({
  loader: ({ params }) => getTemplate({ data: { id: params.templateId } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.name }] : [],
  }),
  component: TemplatePage,
});

type Point = "date" | "payee" | "words" | "figures" | "memo" | "crossing";
const POINTS: Point[] = [
  "date",
  "payee",
  "words",
  "figures",
  "memo",
  "crossing",
];
const s = (n: number) => String(n);
const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function toForm(layout: Layout) {
  const f: Record<string, string> = { fontSizePt: s(layout.fontSizePt) };
  for (const p of POINTS) {
    f[`${p}.x`] = s(layout[p].x);
    f[`${p}.y`] = s(layout[p].y);
  }
  f["payee.w"] = s(layout.payee.w);
  f["words.w"] = s(layout.words.w);
  f["words.lines"] = s(layout.words.lines);
  f["words.x2"] = s(layout.words.x2);
  f["words.y2"] = s(layout.words.y2);
  return f;
}

function fromForm(f: Record<string, string>): Layout {
  const pt = (p: Point) => ({ x: num(f[`${p}.x`]!), y: num(f[`${p}.y`]!) });
  return {
    fontSizePt: num(f.fontSizePt!),
    date: pt("date"),
    payee: { ...pt("payee"), w: num(f["payee.w"]!) },
    words: {
      ...pt("words"),
      w: num(f["words.w"]!),
      lines: f["words.lines"] === "1" ? 1 : 2,
      x2: num(f["words.x2"]!),
      y2: num(f["words.y2"]!),
    },
    figures: pt("figures"),
    memo: pt("memo"),
    crossing: pt("crossing"),
  };
}

function TemplatePage() {
  const t = Route.useLoaderData();
  return <TemplateEditor key={t.id} template={t} />;
}

function TemplateEditor({
  template: t,
}: {
  template: Awaited<ReturnType<typeof getTemplate>>;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const [name, setName] = useState(t.name);
  const [bankName, setBankName] = useState(t.bankName);
  const [currency, setCurrency] = useState(t.currency);
  const [width, setWidth] = useState(s(t.widthMm));
  const [height, setHeight] = useState(s(t.heightMm));
  const [form, setForm] = useState(() => toForm(t.layout));
  const [offset, setOffset] = useState({ x: s(t.offset.x), y: s(t.offset.y) });
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const readOnly = !t.canEdit;

  const shape = {
    widthMm: num(width) || 1,
    heightMm: num(height) || 1,
    layout: fromForm(form),
  };
  const sample: ChequeText = {
    date: formatDate(today()),
    payee: "Payee name",
    words: amountInWords(1234550, currency, "en"),
    figures: formatAmount(1234550, currency),
    memo: "Memo",
    crossed: true,
  };

  async function run(
    label: string,
    work: () => Promise<unknown>,
    done?: string,
  ) {
    setBusy(label);
    try {
      await work();
      if (done) toast.success(done);
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  const input = (key: string, label: string) => (
    <Field label={label} htmlFor={`pos-${key.replace(".", "-")}`}>
      <Input
        id={`pos-${key.replace(".", "-")}`}
        data-testid={`pos-${key.replace(".", "-")}`}
        type="number"
        step="any"
        disabled={readOnly}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </Field>
  );

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        backLink={
          <Link
            to="/templates"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Templates
          </Link>
        }
        title={t.name}
        description={
          t.builtIn ? <Badge variant="secondary">Built-in</Badge> : null
        }
        actions={
          <>
            <Button
              variant="outline"
              pending={busy === "copy"}
              onClick={() =>
                run("copy", async () => {
                  const { id } = await copyTemplate({ data: { id: t.id } });
                  await navigate({
                    to: "/templates/$templateId",
                    params: { templateId: id },
                  });
                })
              }
            >
              <Copy aria-hidden />
              Copy template
            </Button>
            {t.canEdit ? (
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                Delete template
              </Button>
            ) : null}
          </>
        }
      />

      <ChequePreview template={shape} text={sample} />

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            "save",
            async () => {
              await updateTemplate({
                data: {
                  id: t.id,
                  name,
                  bankName,
                  currency,
                  widthMm: num(width),
                  heightMm: num(height),
                  layout: fromForm(form),
                },
              });
              await router.invalidate();
            },
            "Template saved",
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="template-name">
            <Input
              id="template-name"
              data-testid="template-name"
              required
              disabled={readOnly}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Bank" htmlFor="template-bank">
            <Input
              id="template-bank"
              data-testid="template-bank"
              disabled={readOnly}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </Field>
          <Field label="Currency" htmlFor="template-currency">
            <SimpleSelect
              id="template-currency"
              testId="template-currency"
              disabled={readOnly}
              items={CURRENCY_CODES.map((c) => ({ value: c, label: c }))}
              value={currency}
              onChange={setCurrency}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Width (mm)" htmlFor="template-width">
              <Input
                id="template-width"
                data-testid="template-width"
                type="number"
                step="any"
                disabled={readOnly}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </Field>
            <Field label="Height (mm)" htmlFor="template-height">
              <Input
                id="template-height"
                data-testid="template-height"
                type="number"
                step="any"
                disabled={readOnly}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </Field>
            {input("fontSizePt", "Text (pt)")}
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">
            Field positions (mm from the top-left corner)
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {POINTS.map((p) => (
              <div
                key={p}
                className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4"
              >
                <p className="col-span-2 self-center text-sm font-medium sm:col-span-1">
                  {FIELD_LABELS[p]}
                </p>
                {input(`${p}.x`, "From left")}
                {input(`${p}.y`, "From top")}
                {p === "payee" || p === "words"
                  ? input(`${p}.w`, "Width")
                  : null}
                {p === "words" ? (
                  <>
                    <Field label="Lines" htmlFor="pos-words-lines">
                      <SimpleSelect
                        id="pos-words-lines"
                        testId="pos-words-lines"
                        disabled={readOnly}
                        items={[
                          { value: "1", label: "One line" },
                          { value: "2", label: "Two lines" },
                        ]}
                        value={form["words.lines"]!}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, "words.lines": v }))
                        }
                      />
                    </Field>
                    {form["words.lines"] === "2" ? (
                      <>
                        {input("words.x2", "Line 2 from left")}
                        {input("words.y2", "Line 2 from top")}
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {t.canEdit ? (
          <Button type="submit" pending={busy === "save"}>
            Save template
          </Button>
        ) : null}
      </form>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Your printer alignment</h2>
          <p className="text-sm text-muted-foreground">
            Moves every field on your prints of this template. Positive values
            move right and down.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "offset",
              async () => {
                await saveOffset({
                  data: {
                    templateId: t.id,
                    offsetXMm: num(offset.x),
                    offsetYMm: num(offset.y),
                  },
                });
                await router.invalidate();
              },
              "Alignment saved",
            );
          }}
        >
          <Field
            label="Horizontal (mm)"
            htmlFor="offset-x"
            className="grid w-36 gap-1.5"
          >
            <Input
              id="offset-x"
              data-testid="offset-x"
              type="number"
              step="any"
              min={-30}
              max={30}
              value={offset.x}
              onChange={(e) => setOffset((o) => ({ ...o, x: e.target.value }))}
            />
          </Field>
          <Field
            label="Vertical (mm)"
            htmlFor="offset-y"
            className="grid w-36 gap-1.5"
          >
            <Input
              id="offset-y"
              data-testid="offset-y"
              type="number"
              step="any"
              min={-30}
              max={30}
              value={offset.y}
              onChange={(e) => setOffset((o) => ({ ...o, y: e.target.value }))}
            />
          </Field>
          <Button type="submit" variant="outline" pending={busy === "offset"}>
            Save alignment
          </Button>
          <Button type="button" variant="ghost" onClick={() => window.print()}>
            <Printer aria-hidden />
            Print a test
          </Button>
        </form>
      </section>
      <PrintSheet
        template={shape}
        text={sample}
        offset={{ x: num(offset.x), y: num(offset.y) }}
      />

      {deleting ? (
        <ConfirmDialog
          title={`Delete ${t.name}?`}
          confirmLabel="Delete template"
          destructive
          pending={busy === "delete"}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            run("delete", async () => {
              await deleteTemplate({ data: { id: t.id } });
              await navigate({ to: "/templates" });
            })
          }
        >
          Cheques printed with it keep their records but lose their reprint
          preview.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
