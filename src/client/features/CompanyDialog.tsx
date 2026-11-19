import { useState } from "react";
import { FormDialog } from "@/client/components/FormDialog";
import { Field } from "@/client/components/Field";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";

interface CompanyValues {
  name: string;
  address: string;
  tradeNumber: string;
}

export function CompanyDialog({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: CompanyValues;
  onSubmit: (values: CompanyValues) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<CompanyValues>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    tradeNumber: initial?.tradeNumber ?? "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set =
    (key: keyof CompanyValues) => (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <FormDialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="company-form" pending={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="company-form"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Name" htmlFor="company-name">
          <Input
            id="company-name"
            data-testid="company-name"
            required
            value={values.name}
            onChange={set("name")}
          />
        </Field>
        <Field label="Address (optional)" htmlFor="company-address">
          <Textarea
            id="company-address"
            data-testid="company-address"
            rows={2}
            value={values.address}
            onChange={set("address")}
          />
        </Field>
        <Field label="Trade licence number (optional)" htmlFor="company-trade">
          <Input
            id="company-trade"
            data-testid="company-trade"
            value={values.tradeNumber}
            onChange={set("tradeNumber")}
          />
        </Field>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </FormDialog>
  );
}
