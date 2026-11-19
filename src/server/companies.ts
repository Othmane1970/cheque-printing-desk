import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, chequeBooks, cheques, companies, users } from "@/db/schema";
import { CURRENCY_CODES } from "@/shared/money";
import { companyScope, UserError, type Actor } from "./actor";

const text = (max: number) => z.string().trim().max(max);
const id = z.string().min(1).max(64);

export const companyInput = z
  .object({
    name: text(120).min(1, "Name is required"),
    address: text(300).default(""),
    tradeNumber: text(60).default(""),
  })
  .strict();
export const updateCompanyInput = companyInput.extend({ id }).strict();
export const idInput = z.object({ id }).strict();

export const accountInput = z
  .object({
    companyId: id,
    bankName: text(120).min(1, "Bank name is required"),
    accountName: text(120).min(1, "Account name is required"),
    accountNumber: text(60).min(1, "Account number is required"),
    currency: z.enum(CURRENCY_CODES),
  })
  .strict();
export const updateAccountInput = accountInput
  .omit({ companyId: true })
  .extend({ id })
  .strict();

const serial = z.number().int().min(0).max(999_999_999);
export const bookInput = z
  .object({
    accountId: id,
    firstSerial: serial,
    lastSerial: serial,
    lowThreshold: z.number().int().min(0).max(10_000),
  })
  .strict()
  .refine(
    (b) => b.firstSerial <= b.lastSerial,
    "The last serial can't be before the first",
  );
export const updateBookInput = z
  .object({
    id,
    firstSerial: serial,
    lastSerial: serial,
    lowThreshold: z.number().int().min(0).max(10_000),
  })
  .strict()
  .refine(
    (b) => b.firstSerial <= b.lastSerial,
    "The last serial can't be before the first",
  );

type BookState = "ok" | "low" | "used_up";

export function bookStatus(book: {
  nextSerial: number;
  lastSerial: number;
  lowThreshold: number;
}) {
  const leavesLeft = Math.max(0, book.lastSerial - book.nextSerial + 1);
  const state: BookState =
    leavesLeft === 0
      ? "used_up"
      : leavesLeft <= book.lowThreshold
        ? "low"
        : "ok";
  return { leavesLeft, state };
}

export async function listCompanies(actor: Actor) {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      address: companies.address,
      tradeNumber: companies.tradeNumber,
      ownerEmail: users.email,
      ownerId: companies.ownerId,
      accounts: count(accounts.id),
    })
    .from(companies)
    .leftJoin(users, eq(users.id, companies.ownerId))
    .leftJoin(accounts, eq(accounts.companyId, companies.id))
    .where(companyScope(actor))
    .groupBy(companies.id)
    .orderBy(asc(companies.name));
  return rows.map(({ ownerId, ownerEmail, ...row }) => ({
    ...row,
    ownerEmail: ownerId === actor.id ? null : ownerEmail,
  }));
}

async function findCompany(actor: Actor, companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), companyScope(actor)));
  return company ?? null;
}

export async function getCompany(actor: Actor, companyId: string) {
  const company = await findCompany(actor, companyId);
  if (!company) return null;
  const accountRows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, company.id))
    .orderBy(asc(accounts.createdAt), asc(accounts.id));
  const books = accountRows.length
    ? await db
        .select()
        .from(chequeBooks)
        .where(
          inArray(
            chequeBooks.accountId,
            accountRows.map((a) => a.id),
          ),
        )
        .orderBy(asc(chequeBooks.createdAt), asc(chequeBooks.firstSerial))
    : [];
  return {
    company: {
      id: company.id,
      name: company.name,
      address: company.address,
      tradeNumber: company.tradeNumber,
    },
    accounts: accountRows.map((a) => ({
      id: a.id,
      bankName: a.bankName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      currency: a.currency,
      books: books
        .filter((b) => b.accountId === a.id)
        .map((b) => ({
          id: b.id,
          firstSerial: b.firstSerial,
          lastSerial: b.lastSerial,
          nextSerial: b.nextSerial,
          lowThreshold: b.lowThreshold,
          ...bookStatus(b),
        })),
    })),
  };
}

export async function createCompany(
  actor: Actor,
  input: z.infer<typeof companyInput>,
) {
  const id = crypto.randomUUID();
  await db
    .insert(companies)
    .values({ id, orgId: actor.orgId, ownerId: actor.id, ...input });
  return { id };
}

export async function updateCompany(
  actor: Actor,
  { id, ...input }: z.infer<typeof updateCompanyInput>,
) {
  const company = await findCompany(actor, id);
  if (!company) throw new UserError("Company not found");
  await db.update(companies).set(input).where(eq(companies.id, company.id));
  return { id };
}

export async function deleteCompany(
  actor: Actor,
  { id }: z.infer<typeof idInput>,
) {
  const company = await findCompany(actor, id);
  if (!company) throw new UserError("Company not found");
  const [used] = await db
    .select({ n: count() })
    .from(cheques)
    .where(eq(cheques.companyId, id));
  if (used!.n > 0)
    throw new UserError("This company has cheques and can't be deleted");
  const accountIds = (
    await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.companyId, id))
  ).map((a) => a.id);
  await db.batch([
    db
      .delete(chequeBooks)
      .where(
        inArray(chequeBooks.accountId, accountIds.length ? accountIds : [""]),
      ),
    db.delete(accounts).where(eq(accounts.companyId, id)),
    db.delete(companies).where(eq(companies.id, id)),
  ]);
  return { id };
}

/** An account the person may use, with its company. */
async function findAccount(actor: Actor, accountId: string) {
  const [row] = await db
    .select({ account: accounts })
    .from(accounts)
    .innerJoin(companies, eq(companies.id, accounts.companyId))
    .where(and(eq(accounts.id, accountId), companyScope(actor)));
  return row?.account ?? null;
}

export async function createAccount(
  actor: Actor,
  { companyId, ...input }: z.infer<typeof accountInput>,
) {
  if (!(await findCompany(actor, companyId)))
    throw new UserError("Company not found");
  const id = crypto.randomUUID();
  await db.insert(accounts).values({ id, companyId, ...input });
  return { id };
}

export async function updateAccount(
  actor: Actor,
  { id, ...input }: z.infer<typeof updateAccountInput>,
) {
  const account = await findAccount(actor, id);
  if (!account) throw new UserError("Account not found");
  if (input.currency !== account.currency) {
    const [used] = await db
      .select({ n: count() })
      .from(cheques)
      .where(eq(cheques.accountId, id));
    if (used!.n > 0)
      throw new UserError(
        "This account has cheques, so its currency can't change",
      );
  }
  await db.update(accounts).set(input).where(eq(accounts.id, id));
  return { id };
}

export async function deleteAccount(
  actor: Actor,
  { id }: z.infer<typeof idInput>,
) {
  const account = await findAccount(actor, id);
  if (!account) throw new UserError("Account not found");
  const [used] = await db
    .select({ n: count() })
    .from(cheques)
    .where(eq(cheques.accountId, id));
  if (used!.n > 0)
    throw new UserError("This account has cheques and can't be deleted");
  await db.batch([
    db.delete(chequeBooks).where(eq(chequeBooks.accountId, id)),
    db.delete(accounts).where(eq(accounts.id, id)),
  ]);
  return { id };
}

/** A cheque book the person may use, with its account. */
export async function findBook(actor: Actor, bookId: string) {
  const [row] = await db
    .select({ book: chequeBooks, account: accounts })
    .from(chequeBooks)
    .innerJoin(accounts, eq(accounts.id, chequeBooks.accountId))
    .innerJoin(companies, eq(companies.id, accounts.companyId))
    .where(and(eq(chequeBooks.id, bookId), companyScope(actor)));
  return row ?? null;
}

export async function createBook(
  actor: Actor,
  { accountId, ...input }: z.infer<typeof bookInput>,
) {
  if (!(await findAccount(actor, accountId)))
    throw new UserError("Account not found");
  const id = crypto.randomUUID();
  await db
    .insert(chequeBooks)
    .values({ id, accountId, ...input, nextSerial: input.firstSerial });
  return { id };
}

export async function updateBook(
  actor: Actor,
  { id, ...input }: z.infer<typeof updateBookInput>,
) {
  const found = await findBook(actor, id);
  if (!found) throw new UserError("Cheque book not found");
  const { book } = found;
  const used = book.nextSerial > book.firstSerial;
  if (used && input.firstSerial !== book.firstSerial) {
    throw new UserError(
      "This book has cheques, so its first serial can't change",
    );
  }
  if (used && input.lastSerial < book.nextSerial - 1) {
    throw new UserError(
      `The last serial can't be before ${book.nextSerial - 1}, the last one used`,
    );
  }
  await db
    .update(chequeBooks)
    .set({ ...input, nextSerial: used ? book.nextSerial : input.firstSerial })
    .where(eq(chequeBooks.id, id));
  return { id };
}

export async function deleteBook(
  actor: Actor,
  { id }: z.infer<typeof idInput>,
) {
  if (!(await findBook(actor, id)))
    throw new UserError("Cheque book not found");
  const [used] = await db
    .select({ n: count() })
    .from(cheques)
    .where(eq(cheques.bookId, id));
  if (used!.n > 0)
    throw new UserError("This book has cheques and can't be deleted");
  await db.delete(chequeBooks).where(eq(chequeBooks.id, id));
  return { id };
}
