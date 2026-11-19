import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { actorFor } from "@/server/actor";
import * as templates from "@/server/templates";

export const getTemplates = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) =>
    templates.listTemplates(await actorFor(context.user)),
  );

export const getTemplate = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.templateIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const found = await templates.getTemplate(
      await actorFor(context.user),
      data.id,
    );
    if (!found) throw notFound();
    return found;
  });

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) =>
    templates.createTemplate(await actorFor(context.user)),
  );

export const copyTemplate = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.templateIdInput.parse(data))
  .handler(async ({ data, context }) =>
    templates.copyTemplate(await actorFor(context.user), data),
  );

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.templateInput.parse(data))
  .handler(async ({ data, context }) =>
    templates.updateTemplate(await actorFor(context.user), data),
  );

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.templateIdInput.parse(data))
  .handler(async ({ data, context }) =>
    templates.deleteTemplate(await actorFor(context.user), data),
  );

export const saveOffset = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.offsetInput.parse(data))
  .handler(async ({ data, context }) =>
    templates.saveOffset(await actorFor(context.user), data),
  );
