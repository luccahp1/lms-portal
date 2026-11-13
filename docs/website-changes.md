# Request website changes

A client opens their own website inside the portal and points at what they want changed. Button
on the Overview and Requests pages; page `/review`.

## The tools

| Tool | Key | What it is for |
|---|---|---|
| Browse | B | The site works as normal, to reach the right page |
| Comment | C | Click anything and say what should change. A photo or file can be attached; on a picture it offers to upload the replacement |
| Edit text | T | Click wording and type the new wording in place. We get the exact before and after |
| Draw | D | Circle or arrow, then a note. For layout that is hard to describe |
| Page note | | Something not about one spot: a new section, a new page |
| Computer / Phone | | Changes the frame width. A note records the width it was made at |

Notes list on the right, grouped by page: click to jump to one, edit, delete. They save as a
draft as they are made (`change_notes` with no `request_id`), so closing the tab loses nothing.
**Send** turns the draft into one ordinary request, with an optional needed-by date. From there
it is the normal request flow: it reaches LMS Dash by webhook, we tick each note as it is fixed
(`set_change_note_done`), set the request to review, and the client opens **Check the changes on
the page** (`/review?request=<id>`, look only) and approves.

`/review?source=template` runs the same tool on the design the client picked, before there is a site.

Left out on purpose: colour and thickness pickers, shapes, screenshots, voice notes, a priority per note.

## Which site it shows

`clients.review_url` when set (the preview build, `set_review_source`), else `clients.website_url`.

## How the frame works

- `/site/<token>/<path>` (`src/app/site/[token]/[[...path]]/route.ts`) fetches that path from the
  client's site and serves it from the portal, so our script can run inside it. `GET` and `HEAD`
  only: a form in the frame sends nothing, and the site's own visit counting does not fire.
- `src/lib/review/proxy.ts` rewrites same-site addresses in HTML and CSS to point back at the
  frame, strips `integrity` and in-page CSP, and injects `public/review-agent.js` first in `<head>`.
  Relative addresses are left alone; the frame's paths mirror the site's, trailing slash included
  (`skipTrailingSlashRedirect` in `next.config.ts`).
- The agent draws pins, the hover outline and drawings in a shadow root, makes wording editable,
  keeps links inside the frame (outside links open a new tab) and talks to the page around it
  with `postMessage`. `src/app/review/ReviewTool.tsx` owns the tools and saving.
- A note remembers the element it is on (a CSS selector, its text, the click point as a fraction
  of the element, and page pixels as a fallback), so it stays put when the page reflows. A drawing
  only shows on the layout it was drawn on (phone or computer).

## Safety

- Everything the frame serves carries `Content-Security-Policy: sandbox allow-scripts allow-forms
  allow-popups allow-popups-to-escape-sandbox`, and the iframe has the same sandbox. Without
  `allow-same-origin` the client's site runs with an origin of its own: its scripts can't read
  portal cookies or call the portal as the user. Upstream `Set-Cookie` and frame headers are dropped.
- A sandboxed page sends no cookies, so the frame is opened with a signed token in the path
  (`src/lib/review/token.ts`): one client, one source, 12 hours, minted by `/review` after
  `requireClient()`. Set **`REVIEW_SECRET`** in the server `.env` so tokens survive a restart;
  without it each process makes its own and an open frame needs a reload after a restart.
- Only the client's configured host (and its `www` twin) is fetched. Redirects are followed by
  hand; one that leaves the site is passed to the browser. Hosts that resolve to private or
  loopback addresses are refused, so the frame can't be pointed at our own network
  (`REVIEW_ALLOW_PRIVATE=true` is for local testing only). 15 MB and 15 s limits.
- Notes are written only by the signed-in client. An admin, and an admin previewing as the
  client, can read but not write.

## Limits

- A site that builds addresses in JavaScript beyond `fetch`/XHR/`history` (rare on the sites we
  build) may load a file from the wrong place. The site's own pages are the check.
- Sites that need a login, or that block unknown user agents, won't load.
- The host check resolves the name before fetching; it trusts that address for the request.

## Trying it locally

Serve any static site on localhost, set it as a client's `review_url`, and run the portal with
`REVIEW_ALLOW_PRIVATE=true`. Tests: `tests/review.test.ts` (notes, isolation, tokens, rewriting,
and the route against a local fixture server), `tests/intake.test.ts`.
