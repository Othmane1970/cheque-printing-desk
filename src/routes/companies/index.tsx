import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { CompanyDialog } from "@/client/features/CompanyDialog";
import { createCompany, getCompanies } from "@/serverFunctions/companies";

export const Route = createFileRoute("/companies/")({
  loader: () => getCompanies(),
  component: Companies,
});

function Companies() {
  const companies = Route.useLoaderData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      New company
    </Button>
  );

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Companies"
        actions={companies.length ? newButton : null}
      />
      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add a company, then its bank accounts and cheque books."
          action={newButton}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {companies.map((c) => (
            <li key={c.id} data-testid="company-row">
              <Link
                to="/companies/$companyId"
                params={{ companyId: c.id }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  {c.address ? (
                    <span className="block truncate text-sm text-muted-foreground">
                      {c.address}
                    </span>
                  ) : null}
                </span>
                {c.ownerEmail ? (
                  <span className="text-sm text-muted-foreground">
                    {c.ownerEmail}
                  </span>
                ) : null}
                <span className="text-sm text-muted-foreground tabular-nums">
                  {c.accounts} {c.accounts === 1 ? "account" : "accounts"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <CompanyDialog
          title="New company"
          submitLabel="Create company"
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const { id } = await createCompany({ data: values });
            await navigate({
              to: "/companies/$companyId",
              params: { companyId: id },
            });
          }}
        />
      ) : null}
    </AppShell>
  );
}
