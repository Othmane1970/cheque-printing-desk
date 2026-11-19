import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "cheque-printing-desk",
  name: "Cheque Printing Desk",
  description:
    "Fill in, preview and print cheques on your bank's cheque paper, and track each one until it clears.",
  resources: {
    d1: ["DB"],
  },
});
