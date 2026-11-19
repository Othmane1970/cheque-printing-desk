import { and, asc, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { templateOffsets, templates, users } from "@/db/schema";
import { layoutSchema, type Layout } from "@/shared/layout";
import { CURRENCY_CODES } from "@/shared/money";
import { UserError, type Actor } from "./actor";

const id = z.string().min(1).max(64);
export const templateInput = z
  .object({
    id,
    name: z.string().trim().min(1, "Name is required").max(120),
    bankName: z.string().trim().max(120),
    currency: z.enum(CURRENCY_CODES),
    widthMm: z.number().min(50).max(400),
    heightMm: z.number().min(30).max(200),
    layout: layoutSchema,
  })
  .strict();
export const offsetInput = z
  .object({
    templateId: id,
    offsetXMm: z.number().min(-30).max(30),
    offsetYMm: z.number().min(-30).max(30),
  })
  .strict();
export const templateIdInput = z.object({ id }).strict();

/** Built-ins, plus every custom template in the person's org. */
function visible(actor: Actor) {
  return or(eq(templates.builtIn, true), eq(templates.orgId, actor.orgId))!;
}

function canEdit(
  actor: Actor,
  t: { builtIn: boolean; ownerId: string | null; orgId: string | null },
) {
  return (
    !t.builtIn &&
    t.orgId === actor.orgId &&
    (actor.admin || t.ownerId === actor.id)
  );
}

function shape(t: typeof templates.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    bankName: t.bankName,
    currency: t.currency,
    builtIn: t.builtIn,
    widthMm: t.widthMm,
    heightMm: t.heightMm,
    layout: JSON.parse(t.layout) as Layout,
  };
}

export async function listTemplates(actor: Actor) {
  const rows = await db
    .select({ template: templates, ownerEmail: users.email })
    .from(templates)
    .leftJoin(users, eq(users.id, templates.ownerId))
    .where(visible(actor))
    .orderBy(desc(templates.builtIn), asc(templates.name));
  return rows.map(({ template, ownerEmail }) => ({
    ...shape(template),
    ownerEmail: template.ownerId === actor.id ? null : ownerEmail,
    canEdit: canEdit(actor, template),
  }));
}

/** The person's own printer offset for each template they've aligned. */
export async function offsetsFor(actor: Actor) {
  const rows = await db
    .select()
    .from(templateOffsets)
    .where(eq(templateOffsets.userId, actor.id));
  return Object.fromEntries(
    rows.map((r) => [r.templateId, { x: r.offsetXMm, y: r.offsetYMm }]),
  );
}

export async function getTemplate(actor: Actor, templateId: string) {
  const [row] = await db
    .select({ template: templates, offset: templateOffsets })
    .from(templates)
    .leftJoin(
      templateOffsets,
      and(
        eq(templateOffsets.templateId, templates.id),
        eq(templateOffsets.userId, actor.id),
      ),
    )
    .where(and(eq(templates.id, templateId), visible(actor)));
  if (!row) return null;
  return {
    ...shape(row.template),
    canEdit: canEdit(actor, row.template),
    offset: { x: row.offset?.offsetXMm ?? 0, y: row.offset?.offsetYMm ?? 0 },
  };
}

export async function copyTemplate(
  actor: Actor,
  { id: sourceId }: z.infer<typeof templateIdInput>,
) {
  const source = await getTemplate(actor, sourceId);
  if (!source) throw new UserError("Template not found");
  const id = crypto.randomUUID();
  await db.insert(templates).values({
    id,
    orgId: actor.orgId,
    ownerId: actor.id,
    builtIn: false,
    name: `Copy of ${source.name}`,
    bankName: source.bankName,
    currency: source.currency,
    widthMm: source.widthMm,
    heightMm: source.heightMm,
    layout: JSON.stringify(source.layout),
  });
  return { id };
}

export async function updateTemplate(
  actor: Actor,
  { id, layout, ...input }: z.infer<typeof templateInput>,
) {
  const [existing] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id));
  if (!existing || !canEdit(actor, existing))
    throw new UserError("You can't edit this template");
  await db
    .update(templates)
    .set({ ...input, layout: JSON.stringify(layout) })
    .where(
      and(
        eq(templates.id, id),
        eq(templates.builtIn, false),
        eq(templates.orgId, actor.orgId),
      ),
    );
  return { id };
}

export async function deleteTemplate(
  actor: Actor,
  { id }: z.infer<typeof templateIdInput>,
) {
  const [existing] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id));
  if (!existing || !canEdit(actor, existing))
    throw new UserError("You can't delete this template");
  await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.builtIn, false)));
  return { id };
}

export async function saveOffset(
  actor: Actor,
  input: z.infer<typeof offsetInput>,
) {
  if (!(await getTemplate(actor, input.templateId)))
    throw new UserError("Template not found");
  await db
    .insert(templateOffsets)
    .values({ userId: actor.id, ...input })
    .onConflictDoUpdate({
      target: [templateOffsets.userId, templateOffsets.templateId],
      set: { offsetXMm: input.offsetXMm, offsetYMm: input.offsetYMm },
    });
  return { ok: true };
}

const BLANK_LAYOUT: Layout = {
  fontSizePt: 11,
  date: { x: 135, y: 10 },
  payee: { x: 20, y: 26, w: 115 },
  words: { x: 28, y: 34, w: 107, lines: 2, x2: 10, y2: 42 },
  figures: { x: 138, y: 38 },
  memo: { x: 12, y: 58 },
  crossing: { x: 65, y: 4 },
};

export async function createTemplate(actor: Actor) {
  const id = crypto.randomUUID();
  await db.insert(templates).values({
    id,
    orgId: actor.orgId,
    ownerId: actor.id,
    builtIn: false,
    name: "New template",
    bankName: "",
    currency: "AED",
    widthMm: 175,
    heightMm: 80,
    layout: JSON.stringify(BLANK_LAYOUT),
  });
  return { id };
}
