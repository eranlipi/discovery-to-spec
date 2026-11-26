# Privacy

The discovery-to-spec plugin collects nothing. It has no servers, no accounts, no analytics and no telemetry, and its author never receives any of your data.

## What the plugin reads and writes

Everything stays in your own git repository, on your computer or wherever you run Claude.

- **It reads** `.d2s.json` and the documents in your design folder (`design/` unless you chose another): the product context, the decision log and each feature's documents.
- **Research notes can contain personal data.** The `d2s-research` skill reads the raw notes you give it, such as interview notes, which may include names, emails or phone numbers. It is told to anonymize them before it writes `insights.md`, and not to copy them anywhere else. Check the result before you commit it.
- **Decision documents hold approvers' names.** `decision.md` records who approved a decision: a name, a role, a date and optionally a GitHub handle. People write these lines themselves; the skills never fill them in.

## What the plugin sends

Nothing, to anyone. The skills run the open-source [`discovery-to-spec`](https://www.npmjs.com/package/discovery-to-spec) command line tool, which reads and writes local files and makes no network calls. Running it with `npx` downloads the package from the npm registry, which sends your data nowhere.

The one network call in the project is not part of this plugin: an opt-in CI check you can add to your own GitHub workflow, which asks GitHub who approved a pull request, using that workflow's own token.

Claude itself processes what the skills read, under the terms of your Claude account. If you have connected the Figma MCP server yourself, the skills read the Figma frames your documents link to, under Figma's terms.

## Contact

Questions: [open an issue](https://github.com/eranlipi/discovery-to-spec/issues).
