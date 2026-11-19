import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { actorFor } from "@/server/actor";
import * as cheques from "@/server/cheques";

export const getDashboard = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) =>
    cheques.dashboard(await actorFor(context.user)),
  );

export const getChequeForm = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z
      .object({ from: z.string().max(64).optional() })
      .strict()
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.user);
    const [options, from] = await Promise.all([
      cheques.formOptions(actor),
      data.from ? cheques.getCheque(actor, data.from) : null,
    ]);
    return { ...options, from };
  });

export const createCheque = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => cheques.chequeInput.parse(data))
  .handler(async ({ data, context }) =>
    cheques.createCheque(await actorFor(context.user), data),
  );

export const getCheques = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => cheques.listInput.parse(data))
  .handler(async ({ data, context }) => {
    const actor = await actorFor(context.user);
    const [list, options] = await Promise.all([
      cheques.listCheques(actor, data),
      cheques.filterOptions(actor),
    ]);
    return { ...list, options };
  });

export const getCheque = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => cheques.chequeIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const found = await cheques.getCheque(
      await actorFor(context.user),
      data.id,
    );
    if (!found) throw notFound();
    return found;
  });

export const setChequeStatus = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => cheques.statusInput.parse(data))
  .handler(async ({ data, context }) =>
    cheques.setStatus(await actorFor(context.user), data),
  );
