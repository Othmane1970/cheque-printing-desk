import { and, eq, type SQL } from "drizzle-orm";
import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { db } from "@/db";
import { companies, users } from "@/db/schema";

/** The signed-in person as the queries see them. */
export interface Actor {
  id: string;
  orgId: string;
  admin: boolean;
}

/** Records the person on first sight (email from the identity) and returns who they are. */
export async function actorFor(user: EveryAppUser): Promise<Actor> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email, orgId: user.orgId })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
  return { id: user.id, orgId: user.orgId, admin: isAdmin(user) };
}

/** Companies this person may see: their own, or every one in the org for an admin. */
export function companyScope(actor: Actor): SQL {
  return actor.admin
    ? eq(companies.orgId, actor.orgId)
    : and(eq(companies.orgId, actor.orgId), eq(companies.ownerId, actor.id))!;
}

export class UserError extends Error {}
