---
name: docs-standard
description: Write and review project documentation to the Acycl documentation standard, so the same Markdown reads well on GitHub and renders on acycl.dev. Use when creating, editing, restructuring or reviewing files in a repository's docs/ directory or its docs/README.md index; when adding a page, an alert, tabs, steps or a file tree to docs; when setting up documentation or its CI checks in a new project; or when a site build or docs check reports an unlisted page, a page without a description, raw HTML, a missing link target or an unknown alert type.
---

# Acycl documentation standard

Project docs are plain GitHub Flavored Markdown in `docs/`. The site at
acycl.dev converts the same files, so write nothing for the site alone.

The rules are in `${CLAUDE_PLUGIN_ROOT}/docs/standard.md`. Read it before
writing or reviewing docs; where this summary and that file differ, the
file is right. `${CLAUDE_PLUGIN_ROOT}/docs/adopting.md` covers setting up
a project.

## Before finishing a docs change

Check each of these. Every one fails the conformance check if it is
wrong.

- Each page is a `.md` file named in lowercase kebab-case.
- Each page, the index included, starts with one `# Heading`, followed
  directly by a paragraph that describes the page on its own. Nothing
  comes between them, not even a comment. No front matter.
- `docs/README.md` lists every page exactly once, in bulleted lists of
  `- [Title](page.md) — summary` items. A new page needs a new item; a
  table of pages does not count.
- No raw HTML, inline or block. Put text such as `<name>` in backticks.
- Alerts use only `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or
  `[!CAUTION]`.
- Tab fences (`tab="Label"` after the language) come in adjacent sets of
  two or more with different labels.
- Relative links point at paths that exist in the repository. No link
  starts with `/`, and none points at `localhost` or `127.0.0.1`: put
  such an address in backticks, since GitHub makes a bare URL a link.
- No relative images.

No check catches these, so look for them too:

- Every page sits directly in `docs/`; the site ignores subdirectories.
- An alert marker is alone on the first line of its blockquote, or GitHub
  and the site show a plain quote.
- The index groups its page lists under `##` headings, which name the
  sidebar's groups.
- There are no Mermaid diagrams, which the site shows as plain code.

## Use the structure the site understands

- A procedure is an ordered list with each command in a fence inside its
  step.
- Alternatives, such as two ways to install, are adjacent tab fences.
- A configuration snippet carries `title="path"` after its language.
- A directory layout is a `tree` fence.
- Every fence names its language. Output and command synopses are
  `text`.
- Table cells have a space on each side, the delimiter row included:
  `| --- | --- |`, never `|---|---|`.

A heading that must stay longer than 80 columns, because other pages
link to its anchor, goes between `<!-- markdownlint-disable MD013 -->`
and `<!-- markdownlint-enable MD013 -->`, with a blank line on each side
of the heading. The title cannot be exempted; shorten it instead.

## Check the work

Run the three checks the project's CI runs, from the project's root. The
conformance check needs the converter's dependencies, installed once for
each version of the plugin:

```sh
npm ci --omit=dev --prefix "${CLAUDE_PLUGIN_ROOT}"
node "${CLAUDE_PLUGIN_ROOT}/converter/check.mjs" . docs
npx markdownlint-cli2 --config "${CLAUDE_PLUGIN_ROOT}/.markdownlint-cli2.jsonc" "docs/*.md"
lychee --offline --include-fragments "docs/*.md"
```

The conformance check converts every page as acycl.dev does, writing
nothing, and prints every problem with the file it is in. lychee catches
links to headings that do not exist, which the site build also refuses.
If the plugin's directory cannot be written, install into a checkout of
`acycl/docs-standard` instead, as `${CLAUDE_PLUGIN_ROOT}/docs/adopting.md`
describes. Say so if any check could not be run.

## Keep the project consistent

- The root `README.md` stays short: pitch, install, quick start, and a
  link to the docs.
- When code changes behaviour that a page describes, change the page in
  the same commit.
- A documentation change reaches the site only with a release, so a fix
  to published docs needs a patch release.
