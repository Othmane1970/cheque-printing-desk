// Who may see and change what: members, the admin, outsiders, built-ins.
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
  replay,
  saveCheque,
} from "./lib.mjs";

const runtime = await startRuntime();
const html = async (path, role) => {
  const res = await runtime.fetch(path, { role });
  return { status: res.status, text: await res.text() };
};
try {
  await runtime.assertPrivateAccess([
    "/",
    "/companies",
    "/templates",
    "/cheques",
    "/cheques/new",
  ]);

  // The owner (an admin) sets up a company and writes a cheque.
  const owner = await (await runtime.context("owner")).newPage();
  const companyId = await createCompany(owner, {
    name: "Falcon Ridge Contracting",
  });
  const card = await addAccount(owner, {
    bank: "Gulf Harbour Bank",
    name: "Falcon Ridge Contracting",
    number: "7700-1200-3400",
  });
  await addBook(owner, card, { first: 2001, last: 2050, threshold: 5 });
  const templateId = await copyTemplate(
    owner,
    "Standard UAE cheque",
    "Falcon Ridge leaf",
  );
  const ownerCompanyCall = await capture(
    owner,
    "Falcon Ridge Contracting",
    async () => {
      await owner.goto(`/companies/${companyId}`);
      await owner.getByRole("button", { name: "Edit company" }).click();
      await owner.getByTestId("company-name").fill("Falcon Ridge Contracting");
      await owner.getByRole("button", { name: "Save company" }).click();
    },
  );
  await owner.goto(`/templates/${templateId}`);
  const ownerTemplateCall = await capture(owner, "Falcon Ridge leaf", () =>
    owner.getByRole("button", { name: "Save template" }).click(),
  );
  await owner.getByTestId("offset-x").fill("2");
  await owner.getByRole("button", { name: "Save alignment" }).click();
  await expect(owner.getByText("Alignment saved")).toBeVisible();

  await owner.goto("/cheques/new");
  await fillCheque(owner, {
    payee: "Crescent Steel Works",
    amount: "48200",
    date: day(2),
    memo: "Rebar delivery",
  });
  const createCall = await capture(owner, "Crescent Steel Works", () =>
    owner.getByRole("button", { name: "Save and print" }).click(),
  );
  await owner.waitForURL(/\/cheques\/(?!new)[^/?]+$/);
  const chequeId = owner.url().split("/").pop();
  await expect(owner.getByTestId("cheque-serial")).toHaveText("2001");
  const { pick } = await import("./lib.mjs");
  const statusCall = await capture(owner, chequeId, () =>
    pick(owner, "cheque-status-select", "Issued"),
  );
  await expect(owner.getByTestId("cheque-status")).toHaveText("Issued");

  // Another member sees none of it.
  for (const path of [
    "/",
    "/companies",
    `/companies/${companyId}`,
    "/cheques",
    `/cheques/${chequeId}`,
    `/cheques/new?from=${chequeId}`,
  ]) {
    const page = await html(path, "member");
    expect(page.text, path).not.toContain("Falcon Ridge Contracting");
    expect(page.text, path).not.toContain("Crescent Steel Works");
  }
  expect((await html(`/cheques/${chequeId}`, "member")).status).toBe(404);
  expect((await html(`/companies/${companyId}`, "member")).status).toBe(404);

  // ...and can change none of it, even by sending the owner's own requests.
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/");
  const db = await runtime.database();
  const count = async () =>
    (await db.prepare("select count(*) as n from cheques").first()).n;
  expect(await count()).toBe(1);
  await replay(member, statusCall, (b) => b.replace("issued", "cleared"));
  expect(
    (
      await db
        .prepare("select status from cheques where id = ?")
        .bind(chequeId)
        .first()
    ).status,
  ).toBe("issued");
  await replay(member, ownerCompanyCall, (b) =>
    b.replace("Falcon Ridge Contracting", "Taken Over LLC"),
  );
  expect(
    (
      await db
        .prepare("select name from companies where id = ?")
        .bind(companyId)
        .first()
    ).name,
  ).toBe("Falcon Ridge Contracting");
  await replay(member, createCall);
  expect(await count()).toBe(1);
  // The owner's own replay does go through, so the refusals above are real.
  await replay(owner, statusCall, (b) => b.replace("issued", "cleared"));
  expect(
    (
      await db
        .prepare("select status from cheques where id = ?")
        .bind(chequeId)
        .first()
    ).status,
  ).toBe("cleared");

  // Custom templates: everyone reads them, only the creator or an admin edits them.
  await member.goto(`/templates/${templateId}`);
  await expect(member.getByRole("heading", { level: 1 })).toHaveText(
    "Falcon Ridge leaf",
  );
  await expect(
    member.getByRole("button", { name: "Save template" }),
  ).toHaveCount(0);
  await replay(member, ownerTemplateCall, (b) =>
    b.replace("Falcon Ridge leaf", "Hijacked leaf"),
  );
  expect(
    (
      await db
        .prepare("select name from templates where id = ?")
        .bind(templateId)
        .first()
    ).name,
  ).toBe("Falcon Ridge leaf");
  // Alignment is each person's own.
  await expect(member.getByTestId("offset-x")).toHaveValue("0");

  // Built-in templates can't be changed, not even by an admin.
  const builtIn = await db
    .prepare("select id, name from templates where built_in = 1 limit 1")
    .first();
  await replay(owner, ownerTemplateCall, (b) =>
    b
      .replaceAll(templateId, builtIn.id)
      .replace("Falcon Ridge leaf", "Changed built-in"),
  );
  expect(
    (
      await db
        .prepare("select name from templates where id = ?")
        .bind(builtIn.id)
        .first()
    ).name,
  ).toBe(builtIn.name);

  // The member's own template and company: the admin sees and edits them.
  const memberTemplateId = await copyTemplate(
    member,
    "Standard UAE cheque",
    "Oasis Print leaf",
  );
  const memberCompanyId = await createCompany(member, {
    name: "Oasis Print House",
  });
  expect((await html("/companies", "owner")).text).toContain(
    "Oasis Print House",
  );
  expect((await html(`/companies/${memberCompanyId}`, "owner")).status).toBe(
    200,
  );
  await owner.goto(`/templates/${memberTemplateId}`);
  await owner.getByTestId("template-name").fill("Oasis Print leaf v2");
  await owner.getByRole("button", { name: "Save template" }).click();
  await expect(owner.getByText("Template saved")).toBeVisible();
  // ...but the member can't see the admin's company even now.
  expect((await html("/companies", "member")).text).not.toContain(
    "Falcon Ridge Contracting",
  );

  // No sign-in of the app's own.
  for (const path of ["/login", "/signin", "/sign-in", "/register"]) {
    expect((await runtime.fetch(path, { role: "member" })).status, path).toBe(
      404,
    );
  }
  for (const path of ["/", "/companies", "/cheques/new"]) {
    expect((await html(path, "member")).text).not.toContain('type="password"');
  }
  // Outsiders from another organization are refused.
  for (const path of [
    `/cheques/${chequeId}`,
    `/companies/${memberCompanyId}`,
  ]) {
    expect((await runtime.fetch(path, { role: "outsider" })).status).not.toBe(
      200,
    );
    expect((await runtime.fetch(path)).status).not.toBe(200);
  }
} finally {
  await runtime.close();
}
