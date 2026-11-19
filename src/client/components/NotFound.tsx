import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";

/** An address with nothing behind it, or a record this person can't see. */
export function NotFound() {
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Not found" />
      <EmptyState
        icon={SearchX}
        title="Nothing here"
        description="It doesn't exist, or it isn't shared with you."
        action={
          <Button nativeButton={false} render={<Link to="/" />}>
            Go to overview
          </Button>
        }
      />
    </AppShell>
  );
}
