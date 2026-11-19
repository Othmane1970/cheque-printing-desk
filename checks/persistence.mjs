// Records survive a restart of the Workers.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  addAccount,
  addBook,
  copyTemplate,
  createCompany,
  day,
  fillCheque,
  saveCheque,
} from "./lib.mjs";

const runtime = await startRuntime();
try {
  const page = await (await runtime.context("member")).newPage();
  const companyId = await createCompany(page, {
    name: "Palm Grove Interiors",
    trade: "TL-55021",
  });
  const card = await addAccount(page, {
    bank: "Gulf Harbour Bank",
    name: "Palm Grove Interiors",
    number: "3300-4411-9090",
  });
  await addBook(page, card, { first: 7001, last: 7010, threshold: 3 });
  const templateId = await copyTemplate(
    page,
    "Standard UAE cheque",
    "Palm Grove leaf",
  );
  await page.getByTestId("offset-y").fill("1.25");
  await page.getByRole("button", { name: "Save alignment" }).click();
  await expect(page.getByText("Alignment saved")).toBeVisible();
  await page.goto("/cheques/new");
  await fillCheque(page, {
    template: "Palm Grove leaf",
    payee: "Lattice Joinery",
    amount: "3150.5",
    date: day(5),
    memo: "Cabinet doors",
  });
  const chequeId = await saveCheque(page);

  await runtime.restart();

  const read = async (path) =>
    (await runtime.fetch(path, { role: "member" })).text();
  expect(await read("/companies")).toContain("Palm Grove Interiors");
  const company = await read(`/companies/${companyId}`);
  expect(company).toContain("3300-4411-9090");
  expect(company).toContain("9 leaves left");
  const cheque = await read(`/cheques/${chequeId}`);
  expect(cheque).toContain("Lattice Joinery");
  expect(cheque).toContain("7001");
  expect(await read(`/templates/${templateId}`)).toContain("Palm Grove leaf");
  const after = await (await runtime.context("member")).newPage();
  await after.goto(`/templates/${templateId}`);
  await expect(after.getByTestId("offset-y")).toHaveValue("1.25");
  await after.goto("/");
  await expect(after.getByTestId("due-cheques")).toContainText(
    "Lattice Joinery",
  );
} finally {
  await runtime.close();
}
