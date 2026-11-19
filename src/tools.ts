// The app's tools for AI clients, served by the Gateway at /mcp. They call
// the same scoped queries as the pages.
import { defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { actorFor } from "@/server/actor";
import { dashboard, listCheques, listInput } from "@/server/cheques";
import { listCompanies } from "@/server/companies";

export const tools = defineTools({
  list_companies: {
    description: "List the companies whose cheques the user can see.",
    risk: "read",
    input: z.object({}).strict(),
    handler: async (_input, { user }) => listCompanies(await actorFor(user)),
  },
  search_cheques: {
    description:
      "Search cheques by payee or memo (q) and filter by company id, account id, status (printed, issued, cleared, bounced, void), date range (from, to as YYYY-MM-DD) or amount range (min, max in major units).",
    risk: "read",
    input: listInput,
    handler: async (input, { user }) =>
      listCheques(await actorFor(user), input),
  },
  cheques_due: {
    description:
      "Post-dated cheques due within 7 days or past due and still open, and cheque books that are low or used up.",
    risk: "read",
    input: z.object({}).strict(),
    handler: async (_input, { user }) => dashboard(await actorFor(user)),
  },
});
