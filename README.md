# docs-standard

The documentation standard for Acycl projects. Each project keeps its docs
as plain Markdown in its own repository; this repository says how to
write them so that they read well on GitHub and render on
[acycl.dev](https://acycl.dev) unchanged.

It holds:

- [the standard](docs/standard.md), the layout and syntax every page
  follows;
- a shared [markdownlint configuration](.markdownlint-cli2.jsonc);
- a [reusable workflow](.github/workflows/docs.yml) that checks a
  project's docs in CI;
- the [converter](converter/) that turns a project's docs into the site's
  pages, as a Node package, and a conformance check that runs it on a
  project's docs;
- a Claude Code plugin whose [skill](skills/docs-standard/SKILL.md)
  applies the standard when Claude writes or reviews docs.

## Use it in a project

[Adopting the standard](docs/adopting.md) has the steps. In short, call
the workflow:

```yaml
jobs:
  docs:
    uses: acycl/docs-standard/.github/workflows/docs.yml@v0.2.0
```

and install the plugin:

```sh
claude plugin marketplace add acycl/docs-standard
claude plugin install docs-standard@docs-standard
```

## Documentation

The [documentation](docs/README.md) follows the standard it describes.
