import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, CopyPlus, Printer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import {
  ChequePreview,
  PrintSheet,
  type ChequeText,
} from "@/client/components/ChequeFace";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { StatusBadge, STATUS_LABELS } from "@/client/components/StatusBadge";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { formatDate, formatTimestamp, messageOf } from "@/client/lib/errors";
import { formatAmount, LANGUAGES } from "@/shared/money";
import { getCheque, setChequeStatus } from "@/serverFunctions/cheques";

export const Route = createFileRoute("/cheques/$chequeId")({
  loader: ({ params }) => getCheque({ data: { id: params.chequeId } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Cheque ${loaderData.cheque.serial}` }] : [],
  }),
  component: ChequePage,
});

const OPEN_STATUSES = (
  ["printed", "issued", "cleared", "bounced"] as const
).map((s) => ({ value: s, label: STATUS_LABELS[s] }));

function ChequePage() {
  const { cheque, company, account, template } = Route.useLoaderData();
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const [pending, setPending] = useState(false);
  const isVoid = cheque.status === "void";

  async function changeStatus(status: string) {
    setPending(true);
    try {
      await setChequeStatus({
        data: {
          id: cheque.id,
          status: status as (typeof OPEN_STATUSES)[number]["value"] | "void",
        },
      });
      await router.invalidate();
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setPending(false);
      setVoiding(false);
    }
  }

  const text: ChequeText = {
    date: formatDate(cheque.chequeDate),
    payee: cheque.payee,
    words: cheque.amountWords,
    figures: formatAmount(cheque.amountMinor, cheque.currency),
    memo: cheque.memo,
    crossed: cheque.crossed,
  };

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
        title={
          <>
            Cheque No. <span data-testid="cheque-serial">{cheque.serial}</span>
          </>
        }
        description={`${company.name} · ${account.bankName}`}
        actions={
          <>
            {template ? (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer aria-hidden />
                Print
              </Button>
            ) : null}
            <Link
              to="/cheques/new"
              search={{ from: cheque.id }}
              className={buttonVariants({ variant: "outline" })}
            >
              <CopyPlus aria-hidden />
              Duplicate
            </Link>
            {!isVoid ? (
              <Button variant="destructive" onClick={() => setVoiding(true)}>
                Void
              </Button>
            ) : null}
          </>
        }
      />

      {template ? <ChequePreview template={template} text={text} /> : null}

      <dl
        data-testid="cheque-detail"
        className="grid gap-x-6 gap-y-4 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2"
      >
        <Item label="Status">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={cheque.status} testId="cheque-status" />
            {!isVoid ? (
              <SimpleSelect
                testId="cheque-status-select"
                ariaLabel="Change status"
                className="w-36"
                items={OPEN_STATUSES}
                value={cheque.status}
                disabled={pending}
                onChange={changeStatus}
              />
            ) : null}
          </div>
          <p
            data-testid="status-changed-at"
            className="mt-1 text-muted-foreground"
          >{`Since ${formatTimestamp(cheque.statusChangedAt)}`}</p>
        </Item>
        <Item label="Pay to">{cheque.payee}</Item>
        <Item label="Amount">{`${formatAmount(cheque.amountMinor, cheque.currency)} ${cheque.currency}`}</Item>
        <Item label="Date">{formatDate(cheque.chequeDate)}</Item>
        <Item label="Amount in words" wide>
          <span dir="auto">{cheque.amountWords}</span>
        </Item>
        <Item label="Memo">{cheque.memo || "None"}</Item>
        <Item label="Crossing">
          {cheque.crossed ? "A/C payee only" : "Not crossed"}
        </Item>
        <Item label="Company">
          <Link
            to="/companies/$companyId"
            params={{ companyId: company.id }}
            className="text-primary underline-offset-4 hover:underline"
          >
            {company.name}
          </Link>
        </Item>
        <Item label="Account">{`${account.accountName} · ${account.accountNumber}`}</Item>
        <Item label="Template">{template?.name ?? "Deleted"}</Item>
        <Item label="Words in">
          {LANGUAGES.find((l) => l.value === cheque.language)?.label}
        </Item>
        <Item label="Printed">{formatTimestamp(cheque.createdAt)}</Item>
      </dl>

      {template ? (
        <PrintSheet template={template} text={text} offset={template.offset} />
      ) : null}

      {voiding ? (
        <ConfirmDialog
          title={`Void cheque No. ${cheque.serial}?`}
          confirmLabel="Void cheque"
          destructive
          pending={pending}
          onClose={() => setVoiding(false)}
          onConfirm={() => changeStatus("void")}
        >
          A void cheque can't change status again. Its serial stays used.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function Item({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
