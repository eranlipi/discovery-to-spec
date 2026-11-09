# discovery-to-spec for Figma

A panel inside Figma where designers start explorations, fill each stage, attach frames, pass the gate and read the final summary. Everything is saved to your GitHub repository as the same Markdown files the `d2s` CLI writes, and the gate is the CLI's own code.

> Status: first version. It works with a personal GitHub token and saves straight to one branch. Sign-in with a GitHub App, a pull request per exploration and verified approvals come later.

## Install (development plugin)

1. Get the plugin files: download `d2s-figma-plugin-<version>.zip` from the [latest release](https://github.com/eranlipi/discovery-to-spec/releases) and unzip it, or build it from this repository with `npm run plugin`.
2. In the **Figma desktop app**, open any design file, then **Plugins → Development → Import plugin from manifest…** and pick `manifest.json` from that folder.
3. Run it from **Plugins → Development → discovery-to-spec**.

A development plugin needs no paid Figma plan. To share it with the whole team without each person importing it, publish it as a private organization plugin (Figma Organization or Enterprise plans).

## Connect

The repository needs a `.d2s.json` at its root (`npx d2s init`).

1. Create a token on GitHub: **Settings → Developer settings → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories**, and pick the design repository.
   - Permissions: **Contents: Read and write**.
2. In the plugin, enter the repository (`owner/name`), a branch, and the token.
   - Leave the branch empty to use the default branch, or name a new one (for example `d2s-pilot`) and the plugin creates it.

## What it does

| Screen | What happens |
| --- | --- |
| Explorations | Every exploration with its stage and owner. The ones linked to the open Figma file come first. |
| New exploration | A title and an owner (your Figma name by default). A Hebrew title asks for a short Latin folder name. |
| Stage form | One field per section of the template, with its guidance as helper text. |
| Attach selected frames | Select frames on the canvas, click a field, attach. Each link gets a **Show on canvas** button that jumps to the frame, on any page. |
| Paste from AI | Fills the stage from a document written with the d2s assistant. A discovery session's document fills Frame, Research and Options in turn, through the gate, and stops at Options. What has to wait for a gate is kept on this computer and offered again later. The whole paste is saved as one commit. |
| Next stage | Runs the gate. Gaps show next to their fields. Passing it saves right away. |
| Save | Sends your changes to GitHub as one commit, such as "002-saved-cards: Research updated by Dana via d2s plugin". If someone else changed the same file since you opened it, you choose: keep yours or take theirs. |
| Handoff | Two documents: the summary for design and product, and the handoff for developers, with a **Copy link for developers** button. |

## Where things are kept

- **The documents:** in your GitHub repository, as commits.
- **The token, unsaved drafts, and pasted parts waiting for their stage:** on this computer only, in Figma's plugin storage. Closing the panel loses nothing.
- **Which explorations belong to this file, and the file's link:** in the Figma file itself.

The plugin talks only to `api.github.com`.

## Limits of this version

- Each person needs their own token, and approvals are typed names, not verified reviews.
- Changes go straight to the chosen branch. Use a branch per pilot if you want a pull request before `main`.
- Conflicts are resolved per file, not per section.
- To build frame links the plugin needs the file's key. If Figma doesn't give it to the plugin, it asks once for the file's link (Share → Copy link).
- Archiving explorations is done with the CLI.

## Develop

```bash
npm run plugin:dev     # builds the plugin and serves it next to a fake Figma canvas and a fake GitHub
```

Open the printed address. `figma-plugin/dev/harness.html` runs the real `code.js` against a stand-in `figma` object, and the panel connects to an in-memory GitHub seeded with `examples/checkout`. Tests are in `test/plugin.test.js`; they also run the built panel against `dev/fake-dom.js`, a small stand-in for the browser.

| File | What it is |
| --- | --- |
| `manifest.json` | The plugin manifest |
| `src/code.js` | Figma's side: user name, selection, moving to a frame, plugin storage |
| `src/ui.js` | The panel |
| `src/github.js` | Loading a branch and saving one commit |
| `src/ui.html`, `src/ui.css` | The panel's page and styles |
| `build.mjs` | Builds `dist/`, embedding the d2s core and `site/src/stage-form.js` |
