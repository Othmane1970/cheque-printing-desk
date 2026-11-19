import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** People the Gateway signed in, keyed by its user id, made on first sight. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  orgId: text("org_id").notNull(),
  createdAt: createdAt(),
});

/** A company profile: private to its owner; admins of the org see all. */
export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    tradeNumber: text("trade_number").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("companies_org_owner").on(t.orgId, t.ownerId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    currency: text("currency").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("accounts_company").on(t.companyId)],
);

export const chequeBooks = sqliteTable(
  "cheque_books",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    firstSerial: integer("first_serial").notNull(),
    lastSerial: integer("last_serial").notNull(),
    nextSerial: integer("next_serial").notNull(),
    lowThreshold: integer("low_threshold").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("cheque_books_account").on(t.accountId)],
);

/** A cheque leaf layout. Built-ins have no org or owner and are read-only. */
export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  ownerId: text("owner_id"),
  builtIn: integer("built_in", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull(),
  bankName: text("bank_name").notNull(),
  currency: text("currency").notNull(),
  widthMm: real("width_mm").notNull(),
  heightMm: real("height_mm").notNull(),
  /** JSON: where each field sits, in mm (src/shared/layout.ts). */
  layout: text("layout").notNull(),
  createdAt: createdAt(),
});

/** Each person's printer offset for a template, in mm. */
export const templateOffsets = sqliteTable(
  "template_offsets",
  {
    userId: text("user_id").notNull(),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    offsetXMm: real("offset_x_mm").notNull().default(0),
    offsetYMm: real("offset_y_mm").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.templateId] })],
);

export const cheques = sqliteTable(
  "cheques",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    bookId: text("book_id")
      .notNull()
      .references(() => chequeBooks.id),
    templateId: text("template_id").references(() => templates.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").notNull(),
    serial: integer("serial").notNull(),
    payee: text("payee").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    chequeDate: text("cheque_date").notNull(),
    memo: text("memo").notNull().default(""),
    crossed: integer("crossed", { mode: "boolean" }).notNull().default(false),
    language: text("language").notNull(),
    amountWords: text("amount_words").notNull(),
    status: text("status").notNull().default("printed"),
    statusChangedAt: text("status_changed_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("cheques_book_serial").on(t.bookId, t.serial),
    index("cheques_company_date").on(t.companyId, t.chequeDate),
  ],
);
