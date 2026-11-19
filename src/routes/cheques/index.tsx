import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { StatusBadge, STATUS_LABELS } from "@/client/components/StatusBadge";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatDate } from "@/client/lib/errors";
import { formatAmount } from "@/shared/money";
import { getCheques } from "@/serverFunctions/cheques";

const SORTS = [
  { value: "date_desc", label: "Newest date" },
  { value: "date_asc", label: "Oldest date" },
  { value: "amount_desc", label: "Largest amount" },
  { value: "amount_asc", label: "Smallest amount" },
  { value: "serial_desc", label: "Highest serial" },
  { value: "serial_asc", label: "Lowest serial" },
  { value: "payee_asc", label: "Payee A–Z" },
] as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const decimal = z.string().regex(/^\d+(\.\d+)?$/);
const search = z.object({
  q: z.string().max(100).optional().catch(undefined),
  company: z.string().max(64).optional().catch(undefined),
  account: z.string().max(64).optional().catch(undefined),
  status: z
    .enum(["printed", "issued", "cleared", "bounced", "void"])
    .optional()
    .catch(undefined),
  from: date.optional().catch(undefined),
  to: date.optional().catch(undefined),
  min: z.coerce.string().pipe(decimal).optional().catch(undefined),
  max: z.coerce.string().pipe(decimal).optional().catch(undefined),
  sort: z
    .enum(SORTS.map((s) => s.value) as [string, ...string[]])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  size: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
    .optional()
    .catch(undefined),
});
type Search = z.infer<typeof search>;

export const Route = createFileRoute("/cheques/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCheques({ data: deps }),
  head: () => ({ meta: [{ title: "Cheques" }] }),
  component: ChequesPage,
});

const ALL = "all";

function ChequesPage() {
  const { rows, total, page, size, options } = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/cheques/" });
  const [q, setQ] = useState(filters.q ?? "");

  const update = (change: Partial<Search>) =>
    navigate({
      search: (old) => ({ ...old, ...change, page: undefined }),
      replace: true,
    });

  useEffect(() => {
    if ((filters.q ?? "") === q) return;
    const timer = setTimeout(() => void update({ q: q || undefined }), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const filtered = Object.entries(filters).some(
    ([key, value]) =>
      value !== undefined && !["sort", "page", "size"].includes(key),
  );
  const accounts = options.accounts.filter(
    (a) => !filters.company || a.companyId === filters.company,
  );
  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Cheques"
        description={`${total} ${total === 1 ? "cheque" : "cheques"}`}
        actions={
          <Button nativeButton={false} render={<Link to="/cheques/new" />}>
            <Plus aria-hidden />
            New cheque
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Search payee or memo"
          htmlFor="cheque-search"
          className="grid gap-1.5 sm:col-span-2"
        >
          <Input
            id="cheque-search"
            data-testid="cheque-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
        <Field label="Company" htmlFor="filter-company">
          <SimpleSelect
            id="filter-company"
            testId="filter-company"
            items={[
              { value: ALL, label: "All companies" },
              ...options.companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={filters.company ?? ALL}
            onChange={(v) =>
              update({ company: v === ALL ? undefined : v, account: undefined })
            }
          />
        </Field>
        <Field label="Account" htmlFor="filter-account">
          <SimpleSelect
            id="filter-account"
            testId="filter-account"
            items={[
              { value: ALL, label: "All accounts" },
              ...accounts.map((a) => ({ value: a.id, label: a.label })),
            ]}
            value={filters.account ?? ALL}
            onChange={(v) => update({ account: v === ALL ? undefined : v })}
          />
        </Field>
        <Field label="Status" htmlFor="filter-status">
          <SimpleSelect
            id="filter-status"
            testId="filter-status"
            items={[
              { value: ALL, label: "Any status" },
              ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            value={filters.status ?? ALL}
            onChange={(v) =>
              update({
                status: v === ALL ? undefined : (v as Search["status"]),
              })
            }
          />
        </Field>
        <Field label="Sort by" htmlFor="filter-sort">
          <SimpleSelect
            id="filter-sort"
            testId="filter-sort"
            items={SORTS.map((s) => ({ value: s.value, label: s.label }))}
            value={filters.sort ?? "date_desc"}
            onChange={(v) =>
              navigate({
                search: (old) => ({
                  ...old,
                  sort: v === "date_desc" ? undefined : v,
                  page: undefined,
                }),
                replace: true,
              })
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dated from" htmlFor="filter-from">
            <Input
              id="filter-from"
              data-testid="filter-from"
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => update({ from: e.target.value || undefined })}
            />
          </Field>
          <Field label="Dated to" htmlFor="filter-to">
            <Input
              id="filter-to"
              data-testid="filter-to"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => update({ to: e.target.value || undefined })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AmountFilter
            id="filter-min"
            label="Amount from"
            value={filters.min}
            onChange={(min) => update({ min })}
          />
          <AmountFilter
            id="filter-max"
            label="Amount to"
            value={filters.max}
            onChange={(max) => update({ max })}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            kind="filtered"
            title="No cheques match these filters"
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/cheques" />}
                onClick={() => setQ("")}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No cheques yet"
            description="Cheques you save appear here."
            action={
              <Button nativeButton={false} render={<Link to="/cheques/new" />}>
                New cheque
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pay to</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} data-testid="cheque-row">
                    <TableCell className="tabular-nums">{c.serial}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDate(c.chequeDate)}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <Link
                        to="/cheques/$chequeId"
                        params={{ chequeId: c.id }}
                        className="block truncate font-medium hover:underline"
                      >
                        {c.payee}
                      </Link>
                      {c.memo ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.memo}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {c.companyName}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{`${formatAmount(c.amountMinor, c.currency)} ${c.currency}`}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows</span>
              <SimpleSelect
                testId="page-size"
                ariaLabel="Rows per page"
                className="w-20"
                items={[10, 25, 50].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
                value={String(size)}
                onChange={(v) => update({ size: Number(v) as Search["size"] })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span>{`Page ${page} of ${pages}`}</span>
              {page > 1 ? (
                <Link
                  to="/cheques"
                  search={(old) => ({
                    ...old,
                    page: page - 1 > 1 ? page - 1 : undefined,
                  })}
                  aria-label="Previous page"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Previous
                </Link>
              ) : null}
              {page < pages ? (
                <Link
                  to="/cheques"
                  search={(old) => ({ ...old, page: page + 1 })}
                  aria-label="Next page"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function AmountFilter({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        data-testid={id}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const clean = text.replace(/[,\s]/g, "");
          onChange(/^\d+(\.\d+)?$/.test(clean) ? clean : undefined);
        }}
      />
    </Field>
  );
}
