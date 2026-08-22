# Repo conventions

## Commit messages: English only

Write commit subjects and bodies in **English**, even when the repo content, filenames, or
the working conversation are in Chinese. This is a public GitHub repo — commits are read by
strangers. Do not copy the Chinese style of older commits; existing history stays as is.

Quote Chinese identifiers verbatim when they are the subject of the change
(e.g. `!contains(status, "已完成")`) — don't translate them.

## `public/` is the deploy set; drafts never enter it

`public/` answers exactly one question: **which pages should exist on the live site.**
`~/quartz-smoke.sh` enumerates it and requests every page from `https://jz21.eu.org`, so a
draft page that sneaks in becomes a 404 alert that can never be fixed — the page is not
supposed to be live. (Happened 2026-08-22 with the 012 video note.)

Therefore every draft-aware build writes to `public-drafts/` (gitignored) instead:

- `npm run serve` / `serve:en` / `serve:drafts` — all `QUARTZ_KEEP_DRAFTS=1 … -o public-drafts`
- `~/blog-preview.sh` — same, and `scripts/preview-server.mjs` serves `PREVIEW_DIR`
- only `npx quartz build` (no `KEEP_DRAFTS`) and `quartz-push.sh` write `public/`

This also keeps a long-running `--serve` from fighting `quartz-push.sh` over `public/`
(the rebuild races its `rm -rf` and surfaces as `ENOTEMPTY`).

**To preview a page that is not published yet, run `npm run serve` — never clear its
`draft` flag.** Clearing the flag is what puts it in `public/`, blocks the next push
(the pre-push smoke check refuses a video page with no source ID), and fires the alert.
