# The standard

Every Acycl project keeps its documentation as plain Markdown in its own
repository, and [acycl.dev](https://acycl.dev) renders those same files.
This page is the contract between the two: a page that follows it reads
well on GitHub and converts to the site unchanged.

The site's features come from structure GitHub already renders, or from
code fence metadata GitHub ignores. Nothing in a page is written for the
site alone.

## Layout

```tree
README.md               pitch, install, quick start, link to the docs
docs
  README.md             the index, and the project's home page on the site
  getting-started.md    one page per file
  commands.md
```

- Documentation lives in `docs/` at the root of the repository.
- The directory is flat. Every page is a `.md` file directly in `docs/`;
  the site does not read subdirectories.
- A page's file name is lowercase kebab-case, such as `day-to-day.md`.
  The name is the page's address: `docs/guards.md` in the project
  `git-inlay` is served at `/git-inlay/guards/`.
- `docs/README.md` is the index. It lists every other page exactly once.
- Pages have no front matter. The title and description come from the
  page itself.

## The index

`docs/README.md` is the folder's landing page on GitHub and the project's
home page on the site.

````markdown
# git-inlay documentation

git-inlay keeps private sets of files tracked in git and present in a
repository's working tree, without ever committing them to it.

## Guides

- [Getting started](getting-started.md) — install git-inlay and create a
  first inlay
- [Day-to-day workflows](workflows.md) — record changes and recover files

## Reference

- [Command reference](commands.md) — every command, option and exit status
````

| In the index | On the site |
| --- | --- |
| The `# Heading` | The home page's title |
| The paragraph right after it | The tagline under the title, as plain text |
| A list of `- [Title](page.md) — summary` items | A grid of cards, one per page |
| The `##` heading above a list | The name of that group in the sidebar |
| The order of the lists and their items | The order of the sidebar, and of the previous and next links |
| The first page listed | The target of the "Get started" button |

- Every item of a page list is one link to a page in `docs/`, optionally
  followed by a separator and a summary. The separator is an em dash, an
  en dash, a hyphen or a colon.
- A list that holds anything else is ordinary content and adds nothing to
  the sidebar. So does a table: list pages in a bulleted list.
- A list above the first `##` heading puts its pages at the top level of
  the sidebar.
- A page that the index does not list, a page listed twice, and an index
  that lists no pages each fail the site build.
- Anything else in the index, such as a closing paragraph that links to
  the changelog, stays on the home page as written.

## Pages

````markdown
# Guards

Guards stop a private file from reaching the host repository's history.

## What is guarded
````

- A page starts with one `# Heading`. It is the page's title, and the
  only level-one heading on the page.
- The paragraph right after the title is the page's description, shown
  in search results and link previews. Write one or two sentences that
  make sense on their own. If anything other than a paragraph follows the
  title, the page has no description.
- `##` and `###` headings form the page's table of contents.

## Syntax

Write GitHub Flavored Markdown. The constructs below also mean something
on the site.

### Alerts

A blockquote that opens with an alert marker on a line of its own becomes
an aside.

```markdown
> [!WARNING]
> This rewrites the exclude file.
```

| Marker | Aside on the site |
| --- | --- |
| `[!NOTE]` | Note |
| `[!TIP]` | Tip |
| `[!IMPORTANT]` | Note, titled "Important" |
| `[!WARNING]` | Caution, titled "Warning" |
| `[!CAUTION]` | Danger, titled "Caution" |

Any other marker fails the site build.

### Steps

An ordered list becomes a numbered procedure when any of its items holds
a code block. Write procedures as ordered lists, with each command in a
fence inside its step.

### Tabs

Adjacent code fences that each carry `tab="Label"` after the language
become one set of tabs. GitHub shows them as consecutive code blocks.

````markdown
With Go:

```sh tab="go install"
go install github.com/acycl/git-inlay/cmd/git-inlay@latest
```

From a release archive:

```sh tab="Release archive"
tar -xzf git-inlay.tar.gz
```
````

- A set needs at least two fences, and each label in it is different.
- A paragraph that ends in a colon right before a tab fence moves into
  that tab.
- Sets that offer the same labels stay in step across the project: a
  reader who picks one label sees it selected everywhere.

### File names

`title="path"` after a fence's language puts a file name above the code
block.

````markdown
```json title=".claude/settings.json"
{ "enabledPlugins": {} }
```
````

### File trees

A `tree` fence becomes a file tree. Write one path per line, indent to
nest, and put an optional comment after the name. The
[layout](#layout) above is one.

### Links

| Link | On the site |
| --- | --- |
| Relative, to a page in `docs/`, with or without a fragment | The page's route on the site |
| Relative, to any other file or directory in the repository | That path on GitHub, at the release tag the site is built from |
| A fragment on its own, such as `#layout` | Unchanged |
| An absolute URL | Unchanged |

- Link to pages and files by relative path, as GitHub needs.
- A relative link to a path that does not exist, or that leaves the
  repository, fails the site build.
- Do not start a link with `/`. GitHub reads it from the repository root
  and the site reads it from the site root.
- Fragments follow GitHub's heading anchors: lowercase, spaces as
  hyphens, punctuation dropped.

### Not supported

- **Raw HTML.** GitHub drops tags it does not know and the site reads
  every tag as a component, so any HTML fails the site build. Put text
  such as `<name>` in backticks. HTML comments are allowed and are left
  out of the site.
- **Relative images.** The site cannot serve them yet. An image at an
  absolute URL works.
- **Mermaid diagrams.** GitHub draws them and the site does not yet.
- **Front matter.** A page that opens with it does not start with a
  heading, which fails the site build.

## Content

The rules above are enforced. These are the conventions that keep
projects consistent with each other.

- The root `README.md` is the pitch: what the project is, how to install
  it, a quick start, and a link to the documentation. Detail belongs in
  `docs/`.
- Give each page one job. Most pages are one of four kinds: a tutorial
  that takes a newcomer through a first success, a guide to one task,
  reference to look things up in, or an explanation of how and why the
  project works.
- Group the index by what readers need, with the page a newcomer should
  read first at the top.
- Write each index summary so that the list reads as a table of contents:
  say what the page lets the reader do.
- Keep reference pages true to the code. Generate them from the code, or
  add a test that fails when they drift from it.
- A design record or other page for contributors is still a page: list it
  in the index, under a group of its own.

## Publishing

The site publishes released documentation. Each project has an entry in
`projects.json` in the `acycl/acycl-web` repository:

```json title="projects.json"
{
  "slug": "git-inlay",
  "name": "git-inlay",
  "description": "Track private files in a repository's working tree.",
  "repo": "acycl/git-inlay",
  "tag": "v0.4.0",
  "docs": "docs"
}
```

- `tag` is a release tag such as `v1.2.0`. The site builds the docs at
  that tag, so a documentation change reaches the site when the project
  releases and the entry's `tag` moves to the new release. A fix to the
  docs alone needs a patch release.
- Each page on the site links back to its source file for editing and
  shows the date of the last commit that touched it.

## Checks

| Check | Catches | Runs |
| --- | --- | --- |
| markdownlint, with this repository's configuration | Raw HTML, a missing or repeated title, fences without a language, broken fragments within a page, long lines | In the project's CI, through the [shared workflow](adopting.md) |
| lychee | Relative links to missing files and headings | In the project's CI, through the shared workflow |
| The site's converter | Everything on this page that fails the site build | When the site builds, and locally in a checkout of `acycl/acycl-web` |

To preview a project's docs on the site before a release, check out
`acycl/acycl-web` beside the project and run `npm run dev` there. It reads
the project's working tree.
