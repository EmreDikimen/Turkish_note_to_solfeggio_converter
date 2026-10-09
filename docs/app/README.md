# The app — server, hosting, editor, makam, speed

purpose: index of the live docs about the shipped app itself (not the model, not a single feature)
audience: anyone changing the decode server, the hosting, the editor or the makam table
updated: 2026-10-08

> Current state and the next action are NOT here: see [../STATUS.md](../STATUS.md). The rules that
> bind code anywhere in the app: [../APP-RULES.md](../APP-RULES.md). The commands:
> [../COMMANDS.md](../COMMANDS.md). Single features (voices, instrument views, phone, look, stored
> pages, visit counter, Play Store): [../features/README.md](../features/README.md).

This folder was `docs/mvp/` until 2026-10-08. The **MVP ladder W0–W10 is CLOSED** — the in-browser
pipeline was built, the server went live on 2026-08-06, two friends used it on 2026-08-11 and the
owner made it public on 2026-09-05. The ladder's own record is
[../archive/phases/mvp.md](../archive/phases/mvp.md). What stayed live moved here.

| File | What it owns |
|---|---|
| [standing.md](standing.md) | Settled findings about the server, the build and the shipped features — background, not next actions |
| [deploy.md](deploy.md) | Why decode runs on a server, what it costs, the safety checklist, the hosting choice |
| [deploy-ops.md](deploy-ops.md) | **The commands** to run and redeploy the decode server, and how to swap or revert the model |
| [gcloud-setup.md](gcloud-setup.md) | Google Cloud from scratch, step by step (owner walkthrough) |
| [hosting-setup.md](hosting-setup.md) | Netlify + the Hub weights, step by step (owner walkthrough) |
| [latency.md](latency.md) | How a page could get faster, what each option costs, and why all of it waits |
| [makam.md](makam.md) | The makam intonation table, its sources, and how a page's makam is guessed |
| [editor.md](editor.md) | The editor brief — direct editing on the staff, Mus2-style |
| [editor-built.md](editor-built.md) | What each editor step built, and the traps it found |
