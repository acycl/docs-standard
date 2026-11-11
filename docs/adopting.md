# Adopting the standard

A project adopts the standard by adding a `docs/` directory, a CI job and
one settings file, and then an entry on the site.

## Set up a project

1. Create `docs/README.md`, the index, and list each page in it. See
   [the index](standard.md#the-index) for what each part becomes on the
   site.

   ````markdown title="docs/README.md"
   # Project documentation

   One or two sentences on what the project does.

   - [Getting started](getting-started.md) — install it and run it once
   ````

2. Write each page as a `.md` file in `docs/` that starts with a
   `# Heading` and a one-paragraph description.
   [The standard](standard.md) has the full rules.

3. Check the docs in CI by calling the shared workflow. Pin it to a
   release tag of this repository.

   ```yaml title=".github/workflows/docs.yml"
   name: docs

   on:
     push:
       branches: [main]
     pull_request:

   permissions:
     contents: read

   jobs:
     docs:
       uses: acycl/docs-standard/.github/workflows/docs.yml@v0.2.0
   ```

   If the docs are not in `docs/`, pass the directory:

   ```yaml
   jobs:
     docs:
       uses: acycl/docs-standard/.github/workflows/docs.yml@v0.2.0
       with:
         docs: documentation
   ```

   If the project already has a CI workflow, add the job to it instead of
   a new file. A release workflow that runs CI before it builds then waits
   on the docs check too, so no release carries docs the site would
   refuse.

   ```yaml title=".github/workflows/ci.yml"
   on:
     push:
       branches: [main]
     pull_request:
     # The release workflow runs these jobs before it builds anything.
     workflow_call:

   jobs:
     docs:
       uses: acycl/docs-standard/.github/workflows/docs.yml@v0.2.0
   ```

4. Turn on the Claude Code plugin for everyone who works in the
   repository.

   ```json title=".claude/settings.json"
   {
     "extraKnownMarketplaces": {
       "docs-standard": {
         "source": { "source": "github", "repo": "acycl/docs-standard" }
       }
     },
     "enabledPlugins": { "docs-standard@docs-standard": true }
   }
   ```

   The settings turn the plugin on but do not download it. Each person
   installs it once per clone:

   ```sh
   claude plugin install docs-standard@docs-standard --scope project
   ```

5. Trim the root `README.md` to the pitch, install, a quick start, and a
   link to the documentation.

## Publish on the site

1. Release the project, so that a tag such as `v1.2.0` holds the docs.

2. Add the project to `projects.json` in `acycl/acycl-web`, or move its
   `tag` to the new release.

   ```json title="projects.json"
   {
     "slug": "my-project",
     "name": "my-project",
     "description": "One line for the site's landing page.",
     "repo": "acycl/my-project",
     "tag": "v1.2.0",
     "docs": "docs"
   }
   ```

The site then serves the project's index at `/my-project/` and each page
under it.

## Check docs locally

The workflow's checks also run from a checkout of this repository beside
the project. The conformance check needs Node and the converter's
dependencies, installed once for each version of the checkout:

```sh
npm ci --omit=dev --prefix ../docs-standard
```

Then, from the project, lint the docs with the standard's configuration,
check their relative links with [lychee](https://lychee.cli.rs), and run
the conformance check:

```sh
npx markdownlint-cli2 --config ../docs-standard/.markdownlint-cli2.jsonc "docs/*.md"
lychee --offline --include-fragments "docs/*.md"
node ../docs-standard/converter/check.mjs . docs
```

The conformance check takes the repository directory and the docs
directory within it. It prints every problem with the file it is in,
and exits with status 1 if there are any.

```text
docs/README.md: lists no pages; list each page in a bulleted list as `- [Title](page.md) — summary`
docs/guards.md: the "# " heading must be followed by a paragraph that describes the page
docs: 2 problems
```

To see the pages as the site renders them, check out `acycl/acycl-web`
beside the project and run its dev server. It reads the project's working
tree once the project is in `projects.json`.

```sh
npm ci
npm run dev
```

## Change a rule for one project

The shared workflow applies this repository's `.markdownlint-cli2.jsonc`
as the base configuration. A `.markdownlint-cli2.jsonc` in the project is
applied on top of it, so a project can relax or tighten single rules:

```jsonc title=".markdownlint-cli2.jsonc"
{
  "config": {
    "MD013": false
  }
}
```

Rules that the site enforces, such as the ban on raw HTML, still fail the
conformance check and the site build whatever the linter allows. To
exempt a single line rather than a whole project, see
[exempting a line](standard.md#exempting-a-line).
