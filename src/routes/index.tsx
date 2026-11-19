import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CalendarClock, Plus } from "lucide-react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { formatDate } from "@/client/lib/errors";
import { formatAmount } from "@/shared/money";
import { getDashboard } from "@/serverFunctions/cheques";

export const Route = createFileRoute("/")({
  loader: () => getDashboard(),
  component: Overview,
});

function Overview() {
  const { due, books } = Route.useLoaderData();
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Overview"
        actions={
          <Button nativeButton={false} render={<Link to="/cheques/new" />}>
            <Plus aria-hidden />
            New cheque
          </Button>
        }
      />

      <section data-testid="due-cheques" className="space-y-3">
        <h2 className="text-base font-semibold">Post-dated cheques due</h2>
        {due.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No cheques due"
            description="Post-dated cheques show here from 7 days before their date until they're cleared or voided."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {due.map((c) => (
              <li key={c.id} data-testid="due-row">
                <Link
                  to="/cheques/$chequeId"
                  params={{ chequeId: c.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {c.payee}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {c.companyName} · No. {c.serial}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {formatAmount(c.amountMinor, c.currency)} {c.currency}
                  </span>
                  <span className="flex items-center gap-2 text-sm tabular-nums">
                    {formatDate(c.chequeDate)}
                    {c.overdue ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-testid="low-books" className="space-y-3">
        <h2 className="text-base font-semibold">Cheque books running out</h2>
        {books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="All cheque books have enough leaves"
            description="A book shows here once its leaves left reach its low-stock threshold."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {books.map((b) => (
              <li key={b.id} data-testid="low-book-row">
                <Link
                  to="/companies/$companyId"
                  params={{ companyId: b.companyId }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {b.bankName} · {b.accountNumber}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {b.companyName} · Serials {b.firstSerial}–{b.lastSerial}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {b.leavesLeft} {b.leavesLeft === 1 ? "leaf" : "leaves"} left
                  </span>
                  <Badge
                    variant={b.state === "used_up" ? "destructive" : "warning"}
                  >
                    {b.state === "used_up" ? "Used up" : "Low"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
