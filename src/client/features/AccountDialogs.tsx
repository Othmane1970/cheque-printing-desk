import { useState, type ReactNode } from "react";
import { FormDialog } from "@/client/components/FormDialog";
import { Field } from "@/client/components/Field";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { messageOf } from "@/client/lib/errors";
import { CURRENCY_CODES } from "@/shared/money";

const CURRENCY_ITEMS = CURRENCY_CODES.map((c) => ({ value: c, label: c }));

/** A dialog whose form saves through `onSubmit` and shows the refusal if there is one. */
function SavingDialog({
  title,
  formId,
  submitLabel,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  formId: string;
  submitLabel: string;
  onSubmit: () => Promise<void>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} pending={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          onSubmit().catch((cause: unknown) => {
            setError(messageOf(cause));
            setPending(false);
          });
        }}
      >
        {children}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </FormDialog>
  );
}

interface AccountValues {
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
}

export function AccountDialog({
  title,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: AccountValues;
  onSubmit: (values: AccountValues) => Promise<void>;
  onClose: () => void;
}) {
  const [v, setV] = useState<AccountValues>({
    bankName: initial?.bankName ?? "",
    accountName: initial?.accountName ?? "",
    accountNumber: initial?.accountNumber ?? "",
    currency: initial?.currency ?? "AED",
  });
  const set =
    (key: keyof AccountValues) => (e: { target: { value: string } }) =>
      setV((old) => ({ ...old, [key]: e.target.value }));
  return (
    <SavingDialog
      title={title}
      formId="account-form"
      submitLabel="Save account"
      onSubmit={() => onSubmit(v)}
      onClose={onClose}
    >
      <Field label="Bank" htmlFor="account-bank">
        <Input
          id="account-bank"
          data-testid="account-bank"
          required
          value={v.bankName}
          onChange={set("bankName")}
        />
      </Field>
      <Field label="Account name" htmlFor="account-name">
        <Input
          id="account-name"
          data-testid="account-name"
          required
          value={v.accountName}
          onChange={set("accountName")}
        />
      </Field>
      <Field label="Account number" htmlFor="account-number">
        <Input
          id="account-number"
          data-testid="account-number"
          required
          value={v.accountNumber}
          onChange={set("accountNumber")}
        />
      </Field>
      <Field label="Currency" htmlFor="account-currency">
        <SimpleSelect
          id="account-currency"
          testId="account-currency"
          items={CURRENCY_ITEMS}
          value={v.currency}
          onChange={(currency) => setV((old) => ({ ...old, currency }))}
        />
      </Field>
    </SavingDialog>
  );
}

interface BookValues {
  firstSerial: number;
  lastSerial: number;
  lowThreshold: number;
}

export function BookDialog({
  title,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: BookValues;
  onSubmit: (values: BookValues) => Promise<void>;
  onClose: () => void;
}) {
  const [v, setV] = useState({
    firstSerial: initial ? String(initial.firstSerial) : "",
    lastSerial: initial ? String(initial.lastSerial) : "",
    lowThreshold: initial ? String(initial.lowThreshold) : "5",
  });
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((old) => ({ ...old, [key]: e.target.value }));
  const number = (key: keyof typeof v, label: string, testId: string) => (
    <Field label={label} htmlFor={testId}>
      <Input
        id={testId}
        data-testid={testId}
        type="number"
        min={0}
        step={1}
        required
        value={v[key]}
        onChange={set(key)}
      />
    </Field>
  );
  return (
    <SavingDialog
      title={title}
      formId="book-form"
      submitLabel="Save book"
      onSubmit={() =>
        onSubmit({
          firstSerial: Number(v.firstSerial),
          lastSerial: Number(v.lastSerial),
          lowThreshold: Number(v.lowThreshold),
        })
      }
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-4">
        {number("firstSerial", "First serial", "book-first")}
        {number("lastSerial", "Last serial", "book-last")}
      </div>
      {number("lowThreshold", "Low when leaves left reach", "book-threshold")}
    </SavingDialog>
  );
}
