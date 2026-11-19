// The main path of every feature, as a person walks it, plus a phone smoke.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  addAccount,
  addBook,
  capture,
  copyTemplate,
  createCompany,
  day,
  fillCheque,
  pick,
  replay,
  saveCheque,
} from "./lib.mjs";

const runtime = await startRuntime();
try {
  const page = await (await runtime.context("owner")).newPage();
  await page.goto("/");
  await runtime.assertBackLink(page);
  await expect(page.getByTestId("due-cheques")).toContainText("No cheques due");
  await expect(page.getByTestId("low-books")).toContainText(
    "All cheque books have enough leaves",
  );

  // F001: company, account, books.
  const companyId = await createCompany(page, {
    name: "Al Noor Trading LLC",
    address: "Office 1204, Marina Tower, Dubai",
    trade: "CN-1048821",
  });
  await expect(page.getByText("CN-1048821")).toBeVisible();
  await page.getByRole("button", { name: "Edit company" }).click();
  await page
    .getByTestId("company-address")
    .fill("Office 1810, Marina Tower, Dubai");
  await page.getByRole("button", { name: "Save company" }).click();
  await expect(
    page.getByText("Office 1810, Marina Tower, Dubai"),
  ).toBeVisible();

  const card = await addAccount(page, {
    bank: "Gulf Harbour Bank",
    name: "Al Noor Trading LLC",
    number: "1012-3344-5566",
  });
  await expect(card).toContainText("AED");
  const book = await addBook(page, card, {
    first: 100001,
    last: 100025,
    threshold: 5,
  });
  await expect(book).toContainText("Next 100001");
  await expect(book).toContainText("25 leaves left");
  await expect(book.getByTestId("book-state")).toHaveCount(0);
  const spare = await addBook(page, card, {
    first: 300001,
    last: 300010,
    threshold: 2,
  });
  await spare.getByRole("button", { name: "Delete book" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete book" })
    .click();
  await expect(
    card.getByTestId("book-row").filter({ hasText: "300001" }),
  ).toHaveCount(0);

  // Edit the account.
  await card.getByRole("button", { name: "Edit account" }).click();
  await page.getByTestId("account-name").fill("Al Noor Trading L.L.C.");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(card).toContainText("Al Noor Trading L.L.C.");

  // A second, empty company can be deleted.
  await createCompany(page, { name: "Old Branch Office" });
  await page.getByRole("button", { name: "Delete company" }).click();
  await Promise.all([
    page.waitForURL(/\/companies$/),
    page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete company" })
      .click(),
  ]);
  await expect(page.getByTestId("company-row")).toHaveCount(1);
  await expect(page.getByTestId("company-row")).toContainText(
    "Al Noor Trading LLC",
  );

  // F002: templates, live preview, alignment.
  const templateId = await copyTemplate(
    page,
    "Standard UAE cheque",
    "Gulf Harbour Bank leaf",
  );
  const payeeX = page.getByTestId("pos-payee-x");
  await payeeX.fill("24");
  await expect(
    page.getByTestId("cheque-preview").getByTestId("field-payee"),
  ).toHaveAttribute("data-x-mm", "24");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByText("Template saved")).toBeVisible();
  await page.getByTestId("offset-x").fill("1.5");
  await page.getByTestId("offset-y").fill("-0.5");
  await page.getByRole("button", { name: "Save alignment" }).click();
  await expect(page.getByText("Alignment saved")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("pos-payee-x")).toHaveValue("24");
  await expect(page.getByTestId("offset-x")).toHaveValue("1.5");
  await expect(page.getByTestId("offset-y")).toHaveValue("-0.5");
  await page.goto("/templates");
  await expect(
    page
      .getByTestId("template-row")
      .filter({ hasText: "Gulf Harbour Bank leaf" }),
  ).toBeVisible();

  // F003: prepare, preview, save and print.
  await page.goto("/cheques/new");
  await fillCheque(page, {
    template: "Gulf Harbour Bank leaf",
    payee: "Desert Line Logistics",
    amount: "12500.75",
    date: day(3),
    memo: "Invoice 2291 freight",
    crossed: true,
  });
  await expect(page.getByTestId("amount-words")).toHaveText(
    "Twelve thousand five hundred UAE dirhams and seventy-five fils only",
  );
  await page.getByRole("radio", { name: "French" }).click();
  await expect(page.getByTestId("amount-words")).toHaveText(
    "Douze mille cinq cents dirhams émiratis et soixante-quinze fils seulement",
  );
  await page.getByRole("radio", { name: "Arabic" }).click();
  await expect(page.getByTestId("amount-words")).toContainText("فقط");
  await expect(page.getByTestId("amount-words")).toContainText("لا غير");
  await page.getByRole("radio", { name: "English" }).click();
  const preview = page.getByTestId("cheque-preview");
  await expect(preview.getByTestId("field-payee")).toHaveText(
    "Desert Line Logistics",
  );
  await expect(preview.getByTestId("field-figures")).toContainText("12,500.75");
  await expect(preview.getByTestId("field-crossing")).toBeVisible();
  const box = await preview.boundingBox();
  const ratio =
    Number(await preview.getAttribute("data-width-mm")) /
    Number(await preview.getAttribute("data-height-mm"));
  expect(Math.abs(box.width / box.height - ratio)).toBeLessThan(0.03);

  const createCall = await capture(page, "Desert Line Logistics", async () => {
    await page.getByRole("button", { name: "Save and print" }).click();
    await page.waitForURL(/\/cheques\/(?!new)[^/?]+$/);
  });
  const firstId = page.url().split("/").pop();
  await expect(page.getByTestId("cheque-serial")).toHaveText("100001");
  await expect(page.getByTestId("cheque-status")).toHaveText("Printed");
  await expect(page.getByTestId("cheque-detail")).toContainText(
    "Invoice 2291 freight",
  );
  await expect(page.getByTestId("cheque-detail")).toContainText(
    "A/C payee only",
  );
  // The print sheet: template size, field text only, shifted by the saved offset.
  await page.emulateMedia({ media: "print" });
  const sheet = page.getByTestId("print-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-width-mm", /\d/);
  await expect(sheet.getByTestId("field-payee")).toHaveText(
    "Desert Line Logistics",
  );
  await expect(sheet.getByTestId("field-payee")).toHaveAttribute(
    "data-x-mm",
    "25.5",
  );
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await expect(sheet).toBeHidden();

  // F004: status tracking.
  await pick(page, "cheque-status-select", "Issued");
  await expect(page.getByTestId("cheque-status")).toHaveText("Issued");
  await expect(page.getByTestId("status-changed-at")).toBeVisible();

  // Duplicate into a new cheque.
  await Promise.all([
    page.waitForURL(/\/cheques\/new\?/),
    page.getByRole("link", { name: "Duplicate" }).click(),
  ]);
  await expect(page.getByTestId("cheque-payee")).toHaveValue(
    "Desert Line Logistics",
  );
  await expect(page.getByTestId("cheque-amount")).toHaveValue("12500.75");
  await page.getByTestId("cheque-payee").fill("Sahara Build Supplies");
  await page.getByTestId("cheque-date").fill(day(20));
  const secondId = await saveCheque(page);
  await expect(page.getByTestId("cheque-serial")).toHaveText("100002");

  await page.goto("/cheques/new");
  await fillCheque(page, {
    template: "Gulf Harbour Bank leaf",
    payee: "Al Waha Stationery",
    amount: "860",
    date: day(0),
    memo: "Office supplies",
  });
  const thirdId = await saveCheque(page);
  await expect(page.getByTestId("cheque-serial")).toHaveText("100003");

  // History: search, filters, sort.
  await page.goto("/cheques");
  await expect(page.getByTestId("cheque-row")).toHaveCount(3);
  await page.getByTestId("cheque-search").fill("Waha");
  await expect(page.getByTestId("cheque-row")).toHaveCount(1);
  await page.getByTestId("cheque-search").fill("freight");
  await expect(page.getByTestId("cheque-row")).toHaveCount(2);
  await page.getByTestId("cheque-search").fill("");
  await expect(page.getByTestId("cheque-row")).toHaveCount(3);
  await pick(page, "filter-status", "Issued");
  await expect(page.getByTestId("cheque-row")).toHaveCount(1);
  await expect(page.getByTestId("cheque-row")).toContainText(
    "Desert Line Logistics",
  );
  await page.goto(`/cheques?company=${companyId}&min=1000`);
  await expect(page.getByTestId("cheque-row")).toHaveCount(2);
  await page.goto(`/cheques?from=${day(10)}`);
  await expect(page.getByTestId("cheque-row")).toHaveCount(1);
  await expect(page.getByTestId("cheque-row")).toContainText(
    "Sahara Build Supplies",
  );
  await page.goto(`/cheques?max=100`);
  await expect(page.getByText("No cheques match these filters")).toBeVisible();
  await page.goto(`/cheques?sort=amount_asc`);
  await expect(page.getByTestId("cheque-row").first()).toContainText(
    "Al Waha Stationery",
  );
  await page.goto(`/cheques?sort=serial_desc`);
  await expect(page.getByTestId("cheque-row").first()).toContainText("100003");

  // Paging: send the first save again until there are 12 cheques.
  for (let i = 0; i < 9; i++) {
    const res = await replay(page, createCall);
    expect(res.status).toBe(200);
  }
  await page.goto(`/cheques?size=10`);
  await expect(page.getByTestId("cheque-row")).toHaveCount(10);
  await Promise.all([
    page.waitForURL(/page=2/),
    page.getByRole("link", { name: "Next page" }).click(),
  ]);
  await expect(page.getByTestId("cheque-row")).toHaveCount(2);
  const serials = await (await runtime.database())
    .prepare("select serial from cheques order by serial")
    .all();
  expect(serials.results.map((r) => r.serial)).toEqual(
    Array.from({ length: 12 }, (_, i) => 100001 + i),
  );

  // Void is final and keeps the serial.
  await page.goto(`/cheques/${thirdId}`);
  await page.getByRole("button", { name: "Void" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Void cheque" })
    .click();
  await expect(page.getByTestId("cheque-status")).toHaveText("Void");
  await expect(page.getByTestId("cheque-serial")).toHaveText("100003");
  await expect(page.getByTestId("cheque-status-select")).toHaveCount(0);

  // A used-up book refuses the next save; a book with cheques can't be deleted.
  await page.goto(`/companies/${companyId}`);
  const card2 = await addAccount(page, {
    bank: "Gulf Harbour Bank",
    name: "Al Noor Petty Cash",
    number: "2020-7788-0001",
    currency: "USD",
  });
  await expect(card2).toContainText("USD");
  await addBook(page, card2, { first: 500, last: 500, threshold: 0 });
  await page.goto("/cheques/new");
  await fillCheque(page, {
    account: "Al Noor Petty Cash · 2020-7788-0001",
    template: "Gulf Harbour Bank leaf",
    payee: "Blue Fin Couriers",
    amount: "45.5",
    date: day(0),
  });
  await expect(page.getByTestId("amount-words")).toHaveText(
    "Forty-five US dollars and fifty cents only",
  );
  await saveCheque(page);
  await expect(page.getByTestId("cheque-serial")).toHaveText("500");
  await page.goto("/cheques/new");
  await fillCheque(page, {
    account: "Al Noor Petty Cash · 2020-7788-0001",
    template: "Gulf Harbour Bank leaf",
    payee: "Blue Fin Couriers",
    amount: "12",
    date: day(0),
  });
  await page.getByRole("button", { name: "Save and print" }).click();
  await expect(page.getByRole("alert")).toContainText("used up");
  await page.goto(`/companies/${companyId}`);
  const usedRow = page.getByTestId("book-row").filter({ hasText: "500–500" });
  await expect(usedRow.getByTestId("book-state")).toHaveText("Used up");
  await usedRow.getByRole("button", { name: "Delete book" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete book" })
    .click();
  await expect(
    page.getByText("This book has cheques and can't be deleted"),
  ).toBeVisible();
  await expect(usedRow).toBeVisible();
  await expect(
    page.getByTestId("book-row").filter({ hasText: "100001–100025" }),
  ).toContainText("13 leaves left");

  // F005: reminders and alerts. Make one older post-dated cheque past due.
  await (
    await runtime.database()
  )
    .prepare("update cheques set cheque_date = ?, created_at = ? where id = ?")
    .bind(day(-2), `${day(-30)} 09:00:00`, secondId)
    .run();
  await page.goto("/");
  const due = page.getByTestId("due-cheques");
  await expect(
    due
      .getByTestId("due-row")
      .filter({ hasText: "Desert Line Logistics" })
      .first(),
  ).toContainText("12,500.75");
  await expect(
    due.getByTestId("due-row").filter({ hasText: "Sahara Build Supplies" }),
  ).toContainText("Overdue");
  await expect(due).not.toContainText("Al Waha Stationery");
  const low = page.getByTestId("low-books");
  await expect(
    low.getByTestId("low-book-row").filter({ hasText: "2020-7788-0001" }),
  ).toContainText("0 leaves left");
  await expect(low).not.toContainText("1012-3344-5566");
  await Promise.all([
    page.waitForURL(new RegExp(`/cheques/${firstId}$`)),
    due
      .getByTestId("due-row")
      .filter({ hasText: "Desert Line Logistics" })
      .first()
      .getByRole("link")
      .click(),
  ]);
  await expect(page.getByTestId("cheque-serial")).toHaveText("100001");
  await runtime.assertBackLink(page);
  await runtime.screenshot(page);

  // Phone-sized smoke.
  const phone = await (
    await runtime.context("member", {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  for (const path of ["/", "/cheques/new", "/cheques"]) {
    await phone.goto(path);
    await expect(phone.getByRole("heading", { level: 1 })).toBeVisible();
    const width = await phone.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(391);
  }
} finally {
  await runtime.close();
}
