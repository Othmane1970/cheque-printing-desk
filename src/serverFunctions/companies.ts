import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { actorFor } from "@/server/actor";
import * as companies from "@/server/companies";

export const getCompanies = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) =>
    companies.listCompanies(await actorFor(context.user)),
  );

export const getCompany = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string().max(64) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const found = await companies.getCompany(
      await actorFor(context.user),
      data.id,
    );
    if (!found) throw notFound();
    return found;
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.companyInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.createCompany(await actorFor(context.user), data),
  );

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.updateCompanyInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.updateCompany(await actorFor(context.user), data),
  );

export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.idInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.deleteCompany(await actorFor(context.user), data),
  );

export const createAccount = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.accountInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.createAccount(await actorFor(context.user), data),
  );

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.updateAccountInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.updateAccount(await actorFor(context.user), data),
  );

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.idInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.deleteAccount(await actorFor(context.user), data),
  );

export const createBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.bookInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.createBook(await actorFor(context.user), data),
  );

export const updateBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.updateBookInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.updateBook(await actorFor(context.user), data),
  );

export const deleteBook = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => companies.idInput.parse(data))
  .handler(async ({ data, context }) =>
    companies.deleteBook(await actorFor(context.user), data),
  );
