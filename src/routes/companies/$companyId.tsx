import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { AccountDialog, BookDialog } from "@/client/features/AccountDialogs";
import { CompanyDialog } from "@/client/features/CompanyDialog";
import { messageOf } from "@/client/lib/errors";
import {
  createAccount,
  createBook,
  deleteAccount,
  deleteBook,
  deleteCompany,
  getCompany,
  updateAccount,
  updateBook,
  updateCompany,
} from "@/serverFunctions/companies";

export const Route = createFileRoute("/companies/$companyId")({
  loader: ({ params }) => getCompany({ data: { id: params.companyId } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.company.name }] : [],
  }),
  component: CompanyPage,
});

type Data = Awaited<ReturnType<typeof getCompany>>;
type Account = Data["accounts"][number];
type Book = Account["books"][number];

type Open =
  | { kind: "edit-company" }
  | { kind: "delete-company" }
  | { kind: "add-account" }
  | { kind: "edit-account"; account: Account }
  | { kind: "delete-account"; account: Account }
  | { kind: "add-book"; account: Account }
  | { kind: "edit-book"; book: Book }
  | { kind: "delete-book"; book: Book }
  | null;

function CompanyPage() {
  const { company, accounts } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Open>(null);
  const [pending, setPending] = useState(false);
  const close = () => setOpen(null);

  async function saved(work: Promise<unknown>) {
    await work;
    await router.invalidate();
    close();
  }

  async function confirm(
    work: () => Promise<unknown>,
    after?: () => Promise<unknown>,
  ) {
    setPending(true);
    try {
      await work();
      if (after) await after();
      else await router.invalidate();
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setPending(false);
      close();
    }
  }

  const addAccountButton = (
    <Button variant="outline" onClick={() => setOpen({ kind: "add-account" })}>
      <Plus aria-hidden />
      Add account
    </Button>
  );

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        backLink={
          <Link
            to="/companies"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Companies
          </Link>
        }
        title={company.name}
        description={
          company.address || company.tradeNumber ? (
            <div className="space-y-0.5">
              {company.address ? (
                <p className="whitespace-pre-line">{company.address}</p>
              ) : null}
              {company.tradeNumber ? (
                <p>{`Trade licence ${company.tradeNumber}`}</p>
              ) : null}
            </div>
          ) : null
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setOpen({ kind: "edit-company" })}
            >
              Edit company
            </Button>
            <Button
              variant="destructive"
              onClick={() => setOpen({ kind: "delete-company" })}
            >
              Delete company
            </Button>
          </>
        }
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Bank accounts</h2>
          {accounts.length ? addAccountButton : null}
        </div>
        {accounts.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No bank accounts yet"
            description="Add an account to give it cheque books."
            action={addAccountButton}
          />
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              data-testid="account-card"
              className="rounded-lg border border-border bg-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{account.bankName}</p>
                  <p className="text-sm text-muted-foreground">{`${account.accountName} · ${account.accountNumber} · ${account.currency}`}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpen({ kind: "add-book", account })}
                  >
                    <Plus aria-hidden />
                    Add cheque book
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit account"
                    onClick={() => setOpen({ kind: "edit-account", account })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete account"
                    onClick={() => setOpen({ kind: "delete-account", account })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              {account.books.length === 0 ? (
                <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  No cheque books yet.
                </p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {account.books.map((book) => (
                    <li
                      key={book.id}
                      data-testid="book-row"
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 font-medium tabular-nums">{`${book.firstSerial}–${book.lastSerial}`}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {book.leavesLeft > 0
                          ? `Next ${book.nextSerial}`
                          : "No leaves left"}
                      </span>
                      <span className="tabular-nums">{`${book.leavesLeft} ${book.leavesLeft === 1 ? "leaf" : "leaves"} left`}</span>
                      {book.state !== "ok" ? (
                        <Badge
                          data-testid="book-state"
                          variant={
                            book.state === "used_up" ? "destructive" : "warning"
                          }
                        >
                          {book.state === "used_up" ? "Used up" : "Low"}
                        </Badge>
                      ) : null}
                      <span className="flex items-center">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Edit book"
                          onClick={() => setOpen({ kind: "edit-book", book })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete book"
                          onClick={() => setOpen({ kind: "delete-book", book })}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>

      {open?.kind === "edit-company" ? (
        <CompanyDialog
          title="Edit company"
          submitLabel="Save company"
          initial={company}
          onClose={close}
          onSubmit={(values) =>
            saved(updateCompany({ data: { id: company.id, ...values } }))
          }
        />
      ) : null}
      {open?.kind === "delete-company" ? (
        <ConfirmDialog
          title={`Delete ${company.name}?`}
          confirmLabel="Delete company"
          destructive
          pending={pending}
          onClose={close}
          onConfirm={() =>
            confirm(
              () => deleteCompany({ data: { id: company.id } }),
              () => navigate({ to: "/companies" }),
            )
          }
        >
          Its accounts and cheque books are deleted too.
        </ConfirmDialog>
      ) : null}
      {open?.kind === "add-account" ? (
        <AccountDialog
          title="Add account"
          onClose={close}
          onSubmit={(values) =>
            saved(createAccount({ data: { companyId: company.id, ...values } }))
          }
        />
      ) : null}
      {open?.kind === "edit-account" ? (
        <AccountDialog
          title="Edit account"
          initial={open.account}
          onClose={close}
          onSubmit={(values) =>
            saved(updateAccount({ data: { id: open.account.id, ...values } }))
          }
        />
      ) : null}
      {open?.kind === "delete-account" ? (
        <ConfirmDialog
          title={`Delete account ${open.account.accountNumber}?`}
          confirmLabel="Delete account"
          destructive
          pending={pending}
          onClose={close}
          onConfirm={() =>
            confirm(() => deleteAccount({ data: { id: open.account.id } }))
          }
        >
          Its cheque books are deleted too.
        </ConfirmDialog>
      ) : null}
      {open?.kind === "add-book" ? (
        <BookDialog
          title="Add cheque book"
          onClose={close}
          onSubmit={(values) =>
            saved(
              createBook({ data: { accountId: open.account.id, ...values } }),
            )
          }
        />
      ) : null}
      {open?.kind === "edit-book" ? (
        <BookDialog
          title="Edit cheque book"
          initial={open.book}
          onClose={close}
          onSubmit={(values) =>
            saved(updateBook({ data: { id: open.book.id, ...values } }))
          }
        />
      ) : null}
      {open?.kind === "delete-book" ? (
        <ConfirmDialog
          title={`Delete book ${open.book.firstSerial}–${open.book.lastSerial}?`}
          confirmLabel="Delete book"
          destructive
          pending={pending}
          onClose={close}
          onConfirm={() =>
            confirm(() => deleteBook({ data: { id: open.book.id } }))
          }
        />
      ) : null}
    </AppShell>
  );
}
