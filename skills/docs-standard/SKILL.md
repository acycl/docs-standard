---
name: docs-standard
description: Write and review project documentation to the Acycl documentation standard, so the same Markdown reads well on GitHub and renders on acycl.dev. Use when creating, editing, restructuring or reviewing files in a repository's docs/ directory or its docs/README.md index; when adding a page, an alert, tabs, steps or a file tree to docs; when setting up documentation or its CI checks in a new project; or when a site build or docs check reports an unlisted page, raw HTML, a missing link target or an unknown alert type.
---

# Acycl documentation standard

Project docs are plain GitHub Flavored Markdown in `docs/`. The site at
acycl.dev converts the same files, so write nothing for the site alone.

The rules are in `${CLAUDE_PLUGIN_ROOT}/docs/standard.md`. Read it before
writing or reviewing docs; where this summary and that file differ, the
file is right. `${CLAUDE_PLUGIN_ROOT}/docs/adopting.md` covers setting up
a project.

## Before finishing a docs change

Check each of these. Every one fails the site build if it is wrong.

- Each page is a `.md` file directly in `docs/`, named in lowercase
  kebab-case.
- Each page starts with one `# Heading`, followed by a paragraph that
  describes the page on its own. No front matter.
- `docs/README.md` lists every page exactly once, in bulleted lists of
  `- [Title](page.md) — summary` items, grouped under `##` headings. A
  new page needs a new item; a table of pages does not count.
- No raw HTML, inline or block. Put text such as `<name>` in backticks.
- Alerts use only `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or
  `[!CAUTION]`, alone on the first line of a blockquote.
- Tab fences (`tab="Label"` after the language) come in adjacent sets of
  two or more with different labels.
- Relative links point at paths that exist in the repository. No link
  starts with `/`.
- No relative images and no Mermaid diagrams.

## Use the structure the site understands

- A procedure is an ordered list with each command in a fence inside its
  step.
- Alternatives, such as two ways to install, are adjacent tab fences.
- A configuration snippet carries `title="path"` after its language.
- A directory layout is a `tree` fence.
- Every fence names its language.

## Check the work

Lint with the standard's configuration:

```sh
npx markdownlint-cli2 --config "${CLAUDE_PLUGIN_ROOT}/.markdownlint-cli2.jsonc" "docs/*.md"
```

The site's converter is the full check. If `acycl/acycl-web` is checked
out beside the project and lists it in `projects.json`, `npm run sync`
there converts the working tree and reports the first rule a page
breaks. Say so if neither check could be run.

## Keep the project consistent

- The root `README.md` stays short: pitch, install, quick start, and a
  link to the docs.
- When code changes behaviour that a page describes, change the page in
  the same commit.
- A documentation change reaches the site only with a release, so a fix
  to published docs needs a patch release.
