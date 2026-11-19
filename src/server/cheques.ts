import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import { accounts, chequeBooks, cheques, companies } from "@/db/schema";
import { amountInWords, MAX_MINOR, parseAmount } from "@/shared/money";
import { companyScope, UserError, type Actor } from "./actor";
import { bookStatus, findBook } from "./companies";
import { getTemplate, offsetsFor, listTemplates } from "./templates";

const STATUSES = ["printed", "issued", "cleared", "bounced", "void"] as const;
type Status = (typeof STATUSES)[number];

const id = z.string().min(1).max(64);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const chequeInput = z
  .object({
    bookId: id,
    templateId: id,
    payee: z.string().trim().min(1, "Payee is required").max(140),
    amount: z.string().trim().min(1, "Amount is required").max(20),
    chequeDate: isoDate,
    memo: z.string().trim().max(140).default(""),
    crossed: z.boolean(),
    language: z.enum(["en", "ar", "fr"]),
  })
  .strict();
export const statusInput = z.object({ id, status: z.enum(STATUSES) }).strict();
export const chequeIdInput = z.object({ id }).strict();

const decimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .optional();
export const listInput = z
  .object({
    q: z.string().max(100).optional(),
    company: id.optional(),
    account: id.optional(),
    status: z.enum(STATUSES).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    min: decimal,
    max: decimal,
    sort: z
      .enum([
        "date_desc",
        "date_asc",
        "amount_desc",
        "amount_asc",
        "serial_desc",
        "serial_asc",
        "payee_asc",
      ])
      .optional(),
    page: z.number().int().min(1).max(10_000).optional(),
    size: z.union([z.literal(10), z.literal(25), z.literal(50)]).optional(),
  })
  .strict();
type ListInput = z.infer<typeof listInput>;

/** Everything the new cheque form needs: the person's companies, accounts, books and the templates. */
export async function formOptions(actor: Actor) {
  const rows = await db
    .select({ company: companies, account: accounts, book: chequeBooks })
    .from(companies)
    .innerJoin(accounts, eq(accounts.companyId, companies.id))
    .leftJoin(chequeBooks, eq(chequeBooks.accountId, accounts.id))
    .where(companyScope(actor))
    .orderBy(
      asc(companies.name),
      asc(accounts.createdAt),
      asc(accounts.id),
      asc(chequeBooks.createdAt),
      asc(chequeBooks.firstSerial),
    );
  const companyList: {
    id: string;
    name: string;
    accounts: {
      id: string;
      label: string;
      bankName: string;
      currency: string;
      books: {
        id: string;
        firstSerial: number;
        lastSerial: number;
        nextSerial: number;
        leavesLeft: number;
      }[];
    }[];
  }[] = [];
  for (const { company, account, book } of rows) {
    let c = companyList.find((x) => x.id === company.id);
    if (!c)
      companyList.push(
        (c = { id: company.id, name: company.name, accounts: [] }),
      );
    let a = c.accounts.find((x) => x.id === account.id);
    if (!a) {
      c.accounts.push(
        (a = {
          id: account.id,
          label: `${account.accountName} · ${account.accountNumber}`,
          bankName: account.bankName,
          currency: account.currency,
          books: [],
        }),
      );
    }
    if (book) {
      a.books.push({
        id: book.id,
        firstSerial: book.firstSerial,
        lastSerial: book.lastSerial,
        nextSerial: book.nextSerial,
        leavesLeft: bookStatus(book).leavesLeft,
      });
    }
  }
  const [templateList, offsets] = await Promise.all([
    listTemplates(actor),
    offsetsFor(actor),
  ]);
  return {
    companies: companyList,
    templates: templateList.map((t) => ({
      ...t,
      offset: offsets[t.id] ?? { x: 0, y: 0 },
    })),
  };
}

export async function createCheque(
  actor: Actor,
  input: z.infer<typeof chequeInput>,
) {
  const found = await findBook(actor, input.bookId);
  if (!found) throw new UserError("Cheque book not found");
  const { book, account } = found;
  if (!(await getTemplate(actor, input.templateId)))
    throw new UserError("Template not found");
  const amountMinor = parseAmount(input.amount, account.currency);
  if (amountMinor === null || amountMinor <= 0 || amountMinor > MAX_MINOR) {
    throw new UserError("Enter an amount greater than zero");
  }
  if (bookStatus(book).leavesLeft === 0)
    throw new UserError("This cheque book is used up");
  const id = crypto.randomUUID();
  const words = amountInWords(amountMinor, account.currency, input.language);
  // The serial is the book's next one; taking it and moving the book on happen together.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO cheques (id, company_id, account_id, book_id, template_id, created_by, serial, payee, amount_minor, currency, cheque_date, memo, crossed, language, amount_words, status)
       SELECT ?, ?, ?, id, ?, ?, next_serial, ?, ?, ?, ?, ?, ?, ?, ?, 'printed'
       FROM cheque_books WHERE id = ? AND next_serial <= last_serial`,
    ).bind(
      id,
      account.companyId,
      account.id,
      input.templateId,
      actor.id,
      input.payee,
      amountMinor,
      account.currency,
      input.chequeDate,
      input.memo,
      input.crossed ? 1 : 0,
      input.language,
      words,
      book.id,
    ),
    env.DB.prepare(
      `UPDATE cheque_books SET next_serial = next_serial + 1 WHERE id = ? AND EXISTS (SELECT 1 FROM cheques WHERE id = ?)`,
    ).bind(book.id, id),
  ]);
  const [made] = await db
    .select({ id: cheques.id })
    .from(cheques)
    .where(eq(cheques.id, id));
  if (!made) throw new UserError("This cheque book is used up");
  return { id };
}

const MINOR_SCALE = sql`(CASE WHEN ${cheques.currency} IN ('KWD','BHD','OMR','TND') THEN 1000 ELSE 100 END)`;

export async function listCheques(actor: Actor, input: ListInput) {
  const where: SQL[] = [companyScope(actor)];
  if (input.q?.trim()) {
    const term = `%${input.q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(
      or(
        sql`${cheques.payee} LIKE ${term} ESCAPE '\\'`,
        sql`${cheques.memo} LIKE ${term} ESCAPE '\\'`,
      )!,
    );
  }
  if (input.company) where.push(eq(cheques.companyId, input.company));
  if (input.account) where.push(eq(cheques.accountId, input.account));
  if (input.status) where.push(eq(cheques.status, input.status));
  if (input.from) where.push(gte(cheques.chequeDate, input.from));
  if (input.to) where.push(lte(cheques.chequeDate, input.to));
  if (input.min)
    where.push(
      sql`${cheques.amountMinor} >= ${Number(input.min)} * ${MINOR_SCALE}`,
    );
  if (input.max)
    where.push(
      sql`${cheques.amountMinor} <= ${Number(input.max)} * ${MINOR_SCALE}`,
    );
  const order = {
    date_desc: [desc(cheques.chequeDate), desc(cheques.serial)],
    date_asc: [asc(cheques.chequeDate), asc(cheques.serial)],
    amount_desc: [desc(cheques.amountMinor), desc(cheques.serial)],
    amount_asc: [asc(cheques.amountMinor), asc(cheques.serial)],
    serial_desc: [desc(cheques.serial), desc(cheques.createdAt)],
    serial_asc: [asc(cheques.serial), asc(cheques.createdAt)],
    payee_asc: [asc(cheques.payee), desc(cheques.chequeDate)],
  }[input.sort ?? "date_desc"];
  const size = input.size ?? 25;
  const page = input.page ?? 1;
  const filter = and(...where);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: cheques.id,
        serial: cheques.serial,
        payee: cheques.payee,
        memo: cheques.memo,
        amountMinor: cheques.amountMinor,
        currency: cheques.currency,
        chequeDate: cheques.chequeDate,
        status: cheques.status,
        companyName: companies.name,
        accountNumber: accounts.accountNumber,
      })
      .from(cheques)
      .innerJoin(companies, eq(companies.id, cheques.companyId))
      .innerJoin(accounts, eq(accounts.id, cheques.accountId))
      .where(filter)
      .orderBy(...order)
      .limit(size)
      .offset((page - 1) * size),
    db
      .select({ n: count() })
      .from(cheques)
      .innerJoin(companies, eq(companies.id, cheques.companyId))
      .where(filter),
  ]);
  return { rows, total: total!.n, page, size };
}

/** Companies and accounts for the history's filters. */
export async function filterOptions(actor: Actor) {
  const rows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      accountId: accounts.id,
      accountName: accounts.accountName,
      accountNumber: accounts.accountNumber,
    })
    .from(companies)
    .leftJoin(accounts, eq(accounts.companyId, companies.id))
    .where(companyScope(actor))
    .orderBy(asc(companies.name), asc(accounts.createdAt));
  const companyList = [
    ...new Map(
      rows.map((r) => [r.companyId, { id: r.companyId, name: r.companyName }]),
    ).values(),
  ];
  const accountList = rows
    .filter((r) => r.accountId)
    .map((r) => ({
      id: r.accountId!,
      companyId: r.companyId,
      label: `${r.accountName} · ${r.accountNumber}`,
    }));
  return { companies: companyList, accounts: accountList };
}

async function findCheque(actor: Actor, chequeId: string) {
  const [row] = await db
    .select({ cheque: cheques, company: companies, account: accounts })
    .from(cheques)
    .innerJoin(companies, eq(companies.id, cheques.companyId))
    .innerJoin(accounts, eq(accounts.id, cheques.accountId))
    .where(and(eq(cheques.id, chequeId), companyScope(actor)));
  return row ?? null;
}

export async function getCheque(actor: Actor, chequeId: string) {
  const row = await findCheque(actor, chequeId);
  if (!row) return null;
  const { cheque, company, account } = row;
  const template = cheque.templateId
    ? await getTemplate(actor, cheque.templateId)
    : null;
  return {
    cheque: {
      id: cheque.id,
      serial: cheque.serial,
      payee: cheque.payee,
      amountMinor: cheque.amountMinor,
      currency: cheque.currency,
      chequeDate: cheque.chequeDate,
      memo: cheque.memo,
      crossed: cheque.crossed,
      language: cheque.language as "en" | "ar" | "fr",
      amountWords: cheque.amountWords,
      status: cheque.status as Status,
      statusChangedAt: cheque.statusChangedAt,
      createdAt: cheque.createdAt,
      bookId: cheque.bookId,
      templateId: cheque.templateId,
    },
    company: { id: company.id, name: company.name },
    account: {
      id: account.id,
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
    },
    template,
  };
}

export async function setStatus(
  actor: Actor,
  { id, status }: z.infer<typeof statusInput>,
) {
  const row = await findCheque(actor, id);
  if (!row) throw new UserError("Cheque not found");
  if (row.cheque.status === "void")
    throw new UserError("A void cheque can't change");
  if (row.cheque.status === status) return { id };
  await db
    .update(cheques)
    .set({ status, statusChangedAt: sql`current_timestamp` })
    .where(and(eq(cheques.id, id), sql`${cheques.status} <> 'void'`));
  return { id };
}

/** Post-dated cheques due within 7 days or past due and still open, and books running out. */
export async function dashboard(actor: Actor) {
  const [due, books] = await Promise.all([
    db
      .select({
        id: cheques.id,
        serial: cheques.serial,
        payee: cheques.payee,
        amountMinor: cheques.amountMinor,
        currency: cheques.currency,
        chequeDate: cheques.chequeDate,
        status: cheques.status,
        companyName: companies.name,
        overdue: sql<number>`${cheques.chequeDate} < date('now')`,
      })
      .from(cheques)
      .innerJoin(companies, eq(companies.id, cheques.companyId))
      .where(
        and(
          companyScope(actor),
          inArray(cheques.status, ["printed", "issued", "bounced"]),
          sql`${cheques.chequeDate} > date(${cheques.createdAt})`,
          sql`${cheques.chequeDate} <= date('now', '+7 days')`,
        ),
      )
      .orderBy(asc(cheques.chequeDate), asc(cheques.serial))
      .limit(100),
    db
      .select({
        book: chequeBooks,
        account: accounts,
        companyName: companies.name,
        companyId: companies.id,
      })
      .from(chequeBooks)
      .innerJoin(accounts, eq(accounts.id, chequeBooks.accountId))
      .innerJoin(companies, eq(companies.id, accounts.companyId))
      .where(
        and(
          companyScope(actor),
          sql`${chequeBooks.lastSerial} - ${chequeBooks.nextSerial} + 1 <= ${chequeBooks.lowThreshold}`,
        ),
      )
      .orderBy(asc(companies.name), asc(chequeBooks.firstSerial)),
  ]);
  return {
    due: due.map((d) => ({ ...d, overdue: Boolean(d.overdue) })),
    books: books.map(({ book, account, companyName, companyId }) => ({
      id: book.id,
      companyId,
      companyName,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      firstSerial: book.firstSerial,
      lastSerial: book.lastSerial,
      ...bookStatus(book),
    })),
  };
}
