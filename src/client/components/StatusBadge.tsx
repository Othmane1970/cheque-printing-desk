import { Badge } from "@/client/components/ui/badge";

export const STATUS_LABELS = {
  printed: "Printed",
  issued: "Issued",
  cleared: "Cleared",
  bounced: "Bounced",
  void: "Void",
} as const;

const VARIANTS = {
  printed: "secondary",
  issued: "info",
  cleared: "success",
  bounced: "destructive",
  void: "outline",
} as const;

export function StatusBadge({
  status,
  testId,
}: {
  status: string;
  testId?: string;
}) {
  const key = (
    status in STATUS_LABELS ? status : "printed"
  ) as keyof typeof STATUS_LABELS;
  return (
    <Badge data-testid={testId} variant={VARIANTS[key]}>
      {STATUS_LABELS[key]}
    </Badge>
  );
}
