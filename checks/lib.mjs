// Shared steps for the suites: each one drives the app the way a person does.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export function day(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Picks an option in one of the app's select menus. */
export async function pick(page, testId, name) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(page.getByTestId(testId)).toContainText(name);
}

export async function createCompany(page, { name, address = "", trade = "" }) {
  await page.goto("/companies");
  await page.getByRole("button", { name: "New company" }).click();
  await page.getByTestId("company-name").fill(name);
  if (address) await page.getByTestId("company-address").fill(address);
  if (trade) await page.getByTestId("company-trade").fill(trade);
  await Promise.all([
    page.waitForURL(/\/companies\/[^/]+$/),
    page.getByRole("button", { name: "Create company" }).click(),
  ]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  return page.url().split("/").pop();
}

/** On a company page: adds an account and returns its card. */
export async function addAccount(page, { bank, name, number, currency }) {
  await page.getByRole("button", { name: "Add account" }).click();
  await page.getByTestId("account-bank").fill(bank);
  await page.getByTestId("account-name").fill(name);
  await page.getByTestId("account-number").fill(number);
  if (currency) await pick(page, "account-currency", currency);
  await page.getByRole("button", { name: "Save account" }).click();
  const card = page.getByTestId("account-card").filter({ hasText: number });
  await expect(card).toBeVisible();
  return card;
}

/** Adds a cheque book to an account card and returns the book's row. */
export async function addBook(page, card, { first, last, threshold }) {
  await card.getByRole("button", { name: "Add cheque book" }).click();
  await page.getByTestId("book-first").fill(String(first));
  await page.getByTestId("book-last").fill(String(last));
  await page.getByTestId("book-threshold").fill(String(threshold));
  await page.getByRole("button", { name: "Save book" }).click();
  const row = card
    .getByTestId("book-row")
    .filter({ hasText: `${first}–${last}` });
  await expect(row).toBeVisible();
  return row;
}

/** Copies a built-in template, renames it and returns the new template's id. */
export async function copyTemplate(page, builtInName, newName) {
  await page.goto("/templates");
  await Promise.all([
    page.waitForURL(/\/templates\/[^/]+$/),
    page
      .getByTestId("template-row")
      .filter({ hasText: builtInName })
      .getByRole("link")
      .first()
      .click(),
  ]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(builtInName);
  await expect(page.getByRole("button", { name: "Save template" })).toHaveCount(
    0,
  );
  const before = page.url();
  await Promise.all([
    page.waitForURL(
      (url) => url.href !== before && /\/templates\/[^/]+$/.test(url.pathname),
    ),
    page.getByRole("button", { name: "Copy template" }).click(),
  ]);
  await page.getByTestId("template-name").fill(newName);
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(newName);
  return page.url().split("/").pop();
}

/** Fills the new cheque form (already open) and saves it; returns the cheque id. */
export async function fillCheque(
  page,
  { company, account, template, payee, amount, date, memo, crossed },
) {
  if (company) await pick(page, "cheque-company", company);
  if (account) await pick(page, "cheque-account", account);
  if (template) await pick(page, "cheque-template", template);
  await page.getByTestId("cheque-payee").fill(payee);
  await page.getByTestId("cheque-amount").fill(amount);
  await page.getByTestId("cheque-date").fill(date);
  await page.getByTestId("cheque-memo").fill(memo ?? "");
  if (crossed) await page.getByTestId("cheque-crossed").click();
}

export async function saveCheque(page) {
  await Promise.all([
    page.waitForURL(/\/cheques\/(?!new)[^/?]+$/),
    page.getByRole("button", { name: "Save and print" }).click(),
  ]);
  await expect(page.getByTestId("cheque-serial")).toBeVisible();
  return page.url().split("/").pop();
}

/** Waits for the app's next server function call matching `match` while `action` runs. */
export async function capture(page, match, action) {
  const [request] = await Promise.all([
    page.waitForRequest(
      (r) =>
        r.url().includes("/_serverFn/") &&
        r.method() === "POST" &&
        (r.postData() ?? "").includes(match),
    ),
    action(),
  ]);
  const headers = {};
  for (const [k, v] of Object.entries(request.headers())) {
    if (k === "content-type" || k === "accept" || k.startsWith("x-"))
      headers[k] = v;
  }
  return { url: request.url(), headers, body: request.postData() };
}

/** Sends a captured server function call again from another person's page. */
export async function replay(page, call, transform = (b) => b) {
  return page.evaluate(
    async ({ url, headers, body }) => {
      const res = await fetch(url, { method: "POST", headers, body });
      return { status: res.status, text: await res.text() };
    },
    { url: call.url, headers: call.headers, body: transform(call.body) },
  );
}
