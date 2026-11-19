import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ChequePreview } from "@/client/components/ChequeFace";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { Switch } from "@/client/components/ui/switch";
import { formatDate, messageOf, today } from "@/client/lib/errors";
import {
  amountInput,
  amountInWords,
  formatAmount,
  LANGUAGES,
  MAX_MINOR,
  parseAmount,
  type Language,
} from "@/shared/money";
import { createCheque, getChequeForm } from "@/serverFunctions/cheques";

export const Route = createFileRoute("/cheques/new")({
  validateSearch: z.object({ from: z.string().max(64).optional() }),
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: ({ deps }) => getChequeForm({ data: { from: deps.from } }),
  head: () => ({ meta: [{ title: "New cheque" }] }),
  component: NewChequePage,
});

type FormData = Awaited<ReturnType<typeof getChequeForm>>;

function NewChequePage() {
  const data = Route.useLoaderData();
  const { from } = Route.useSearch();
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        backLink={
          <Link
            to="/cheques"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Cheques
          </Link>
        }
        title="New cheque"
      />
      {data.companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No bank account to write from"
          description="Add a company with a bank account and a cheque book first."
          action={
            <Button nativeButton={false} render={<Link to="/companies" />}>
              Go to companies
            </Button>
          }
        />
      ) : (
        <ChequeForm key={from ?? "new"} data={data} />
      )}
    </AppShell>
  );
}

function firstBook(books: { id: string; leavesLeft: number }[]) {
  return (books.find((b) => b.leavesLeft > 0) ?? books[0])?.id ?? "";
}

function ChequeForm({ data }: { data: FormData }) {
  const navigate = useNavigate();
  const src = data.from;
  const [companyId, setCompanyId] = useState(
    src && data.companies.some((c) => c.id === src.company.id)
      ? src.company.id
      : data.companies[0]!.id,
  );
  const company = data.companies.find((c) => c.id === companyId)!;
  const [accountId, setAccountId] = useState(
    src && company.accounts.some((a) => a.id === src.account.id)
      ? src.account.id
      : company.accounts[0]!.id,
  );
  const account =
    company.accounts.find((a) => a.id === accountId) ?? company.accounts[0]!;
  const [bookId, setBookId] = useState(firstBook(account.books));
  const [templateId, setTemplateId] = useState(
    (src?.cheque.templateId &&
    data.templates.some((t) => t.id === src.cheque.templateId)
      ? src.cheque.templateId
      : (
          data.templates.find((t) => t.currency === account.currency) ??
          data.templates[0]
        )?.id) ?? "",
  );
  const [payee, setPayee] = useState(src?.cheque.payee ?? "");
  const [amount, setAmount] = useState(
    src ? amountInput(src.cheque.amountMinor, src.cheque.currency) : "",
  );
  const [chequeDate, setChequeDate] = useState(today());
  const [memo, setMemo] = useState(src?.cheque.memo ?? "");
  const [crossed, setCrossed] = useState(src?.cheque.crossed ?? false);
  const [language, setLanguage] = useState<Language>(
    src?.cheque.language ?? "en",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = data.templates.find((t) => t.id === templateId);
  const minor = parseAmount(amount, account.currency);
  const valid = minor !== null && minor > 0 && minor <= MAX_MINOR;
  const words = valid ? amountInWords(minor, account.currency, language) : "";

  function pickCompany(id: string) {
    const next = data.companies.find((c) => c.id === id)!;
    setCompanyId(id);
    setAccountId(next.accounts[0]!.id);
    setBookId(firstBook(next.accounts[0]!.books));
  }
  function pickAccount(id: string) {
    const next = company.accounts.find((a) => a.id === id)!;
    setAccountId(id);
    setBookId(firstBook(next.books));
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const { id } = await createCheque({
        data: {
          bookId,
          templateId,
          payee,
          amount,
          chequeDate,
          memo,
          crossed,
          language,
        },
      });
      await navigate({ to: "/cheques/$chequeId", params: { chequeId: id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="cheque-company">
          <SimpleSelect
            id="cheque-company"
            testId="cheque-company"
            items={data.companies.map((c) => ({ value: c.id, label: c.name }))}
            value={companyId}
            onChange={pickCompany}
          />
        </Field>
        <Field label="Account" htmlFor="cheque-account">
          <SimpleSelect
            id="cheque-account"
            testId="cheque-account"
            items={company.accounts.map((a) => ({
              value: a.id,
              label: a.label,
            }))}
            value={account.id}
            onChange={pickAccount}
          />
        </Field>
        <Field label="Cheque book" htmlFor="cheque-book">
          {account.books.length ? (
            <SimpleSelect
              id="cheque-book"
              testId="cheque-book"
              items={account.books.map((b) => ({
                value: b.id,
                label:
                  b.leavesLeft > 0
                    ? `${b.firstSerial}–${b.lastSerial} · next ${b.nextSerial}`
                    : `${b.firstSerial}–${b.lastSerial} · used up`,
              }))}
              value={bookId}
              onChange={setBookId}
            />
          ) : (
            <p id="cheque-book" className="text-sm text-muted-foreground">
              This account has no cheque book.{" "}
              <Link
                to="/companies/$companyId"
                params={{ companyId }}
                className="text-primary underline-offset-4 hover:underline"
              >
                Add one
              </Link>
            </p>
          )}
        </Field>
        <Field label="Template" htmlFor="cheque-template">
          <SimpleSelect
            id="cheque-template"
            testId="cheque-template"
            items={data.templates.map((t) => ({ value: t.id, label: t.name }))}
            value={templateId}
            onChange={setTemplateId}
          />
        </Field>
        <Field
          label="Pay to"
          htmlFor="cheque-payee"
          className="grid gap-1.5 sm:col-span-2"
        >
          <Input
            id="cheque-payee"
            data-testid="cheque-payee"
            required
            maxLength={140}
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
          />
        </Field>
        <Field label={`Amount (${account.currency})`} htmlFor="cheque-amount">
          <Input
            id="cheque-amount"
            data-testid="cheque-amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amount !== "" && !valid}
          />
        </Field>
        <Field label="Date" htmlFor="cheque-date">
          <Input
            id="cheque-date"
            data-testid="cheque-date"
            type="date"
            required
            value={chequeDate}
            onChange={(e) => setChequeDate(e.target.value)}
          />
        </Field>
        <Field
          label="Memo (optional)"
          htmlFor="cheque-memo"
          className="grid gap-1.5 sm:col-span-2"
        >
          <Input
            id="cheque-memo"
            data-testid="cheque-memo"
            maxLength={140}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Label className="flex items-center gap-2">
          <Switch
            data-testid="cheque-crossed"
            checked={crossed}
            onCheckedChange={setCrossed}
          />
          Crossed: A/C payee only
        </Label>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Words in</span>
          <RadioGroup
            value={language}
            onValueChange={(v) => setLanguage(v as Language)}
            className="flex gap-4"
          >
            {LANGUAGES.map((l) => (
              <Label
                key={l.value}
                className="flex items-center gap-1.5 font-normal"
              >
                <RadioGroupItem value={l.value} aria-label={l.label} />
                {l.label}
              </Label>
            ))}
          </RadioGroup>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Amount in words</p>
        <p data-testid="amount-words" dir="auto" className="min-h-5 text-sm">
          {words}
        </p>
      </div>

      {template ? (
        <ChequePreview
          template={template}
          text={{
            date: formatDate(chequeDate || today()),
            payee,
            words,
            figures: valid ? formatAmount(minor, account.currency) : "",
            memo,
            crossed,
          }}
        />
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" pending={pending} disabled={!bookId || !templateId}>
        Save and print
      </Button>
    </form>
  );
}
