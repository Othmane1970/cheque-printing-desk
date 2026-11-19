import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { messageOf } from "@/client/lib/errors";
import { createTemplate, getTemplates } from "@/serverFunctions/templates";

export const Route = createFileRoute("/templates/")({
  loader: () => getTemplates(),
  component: Templates,
});

function Templates() {
  const templates = Route.useLoaderData();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    try {
      const { id } = await createTemplate();
      await navigate({
        to: "/templates/$templateId",
        params: { templateId: id },
      });
    } catch (cause) {
      toast.error(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Templates"
        actions={
          <Button onClick={create} pending={pending}>
            <Plus aria-hidden />
            New template
          </Button>
        }
      />
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {templates.map((t) => (
          <li key={t.id} data-testid="template-row">
            <Link
              to="/templates/$templateId"
              params={{ templateId: t.id }}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.name}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {[t.bankName, t.currency, `${t.widthMm} × ${t.heightMm} mm`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {t.ownerEmail ? (
                <span className="text-sm text-muted-foreground">
                  {t.ownerEmail}
                </span>
              ) : null}
              {t.builtIn ? <Badge variant="secondary">Built-in</Badge> : null}
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
