# Cheque Printing Desk

Fill in cheques for your companies' bank accounts, preview them, and print the text straight onto your bank's pre-printed cheque paper. Every cheque is kept with its serial and status, with reminders for post-dated ones.

Inspired by https://cheque.plus

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Keep company profiles with their bank accounts and cheque books, and see the leaves left in each book.
- Describe any bank's cheque layout in millimetres with a live preview, and save your own printer alignment for it.
- Prepare a cheque with the amount written out in English, Arabic or French, preview it to scale and print it on the leaf.
- Search, filter, sort and page through past cheques, and mark them issued, cleared, bounced or void.
- See post-dated cheques coming due and cheque books running low on the overview.

Left out: accounts and sign-in, which your Gateway handles; desktop install and offline use; scheduled backups; an Arabic or French interface; per-country bank catalogues; plans and support services.

## Setup

- Install: `pnpm install`
- Run locally: `pnpm dev`
- Test: `pnpm test` for the unit tests; the packaged-release checks are in `checks/`.
- Deploy: `pnpm run deploy`, then open the app from your Gateway.

There are no secrets or settings to configure: the app keeps its data in its own D1 database.

## Limitations

- Each member sees only the companies and cheques they created; organization admins see all of them. Custom templates are shared with every member.
- Printing uses the browser's print dialog. Set the scale to 100% (no "fit to page") so the millimetre positions land where the template says.
- Built-in templates are generic layouts; measure your bank's leaf and copy one to match it.
- The overview's dates use UTC.
- The checks run against a local copy of the release; a real deployment wasn't part of them.
