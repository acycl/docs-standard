// @ts-check
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DocsError,
  convertIndex,
  convertPage,
  escapeHtml,
  frontmatter,
  pageRoute,
  resolveUrl,
} from "./transform.mjs";

/** Repository paths that exist in the fake repository. */
const FILES = new Set([
  "README.md",
  "PLAN.md",
  "docs/README.md",
  "docs/install.md",
  "docs/guards.md",
  "docs/Bad_Name.md",
  "docs/diagram.svg",
]);
const DIRS = new Set(["internal", "docs"]);

/**
 * Returns a page context for a file in the fake repository.
 *
 * @param {string} [file]
 * @returns {import("./transform.mjs").PageContext}
 */
function ctx(file = "install.md") {
  return {
    slug: "git-inlay",
    repo: "acycl/git-inlay",
    ref: "v1.0.0",
    docsDir: "docs",
    file,
    stat: (p) => (FILES.has(p) ? "file" : DIRS.has(p) ? "dir" : undefined),
  };
}

/**
 * Converts a page with a title and a description followed by `body`.
 *
 * @param {string} body
 */
const page = (body) => convertPage(`# Title\n\nAbout.\n\n${body}`, ctx());

describe("convertPage", () => {
  it("takes the title from the heading and the description from the lead", () => {
    const out = convertPage("# Install\n\nGet the  `git-inlay`\nbinary.\n\nMore.\n", ctx());
    assert.equal(out.title, "Install");
    assert.equal(out.description, "Get the git-inlay binary.");
    assert.doesNotMatch(out.body, /# Install/);
    assert.match(out.body, /^Get the/m);
  });

  it("rejects a page without a leading heading", () => {
    assert.throws(() => convertPage("Text.\n", ctx()), /must start with a "# " heading/);
  });

  it("rejects a page without a description", () => {
    for (const source of [
      "# Install\n",
      "# Install\n\n## Steps\n\nText.\n",
      "# Install\n\n- A list.\n",
      "# Install\n\n<!-- A comment. -->\n\nText.\n",
      "# Install\n\n![](https://x.dev/d.svg)\n",
    ]) {
      assert.throws(
        () => convertPage(source, ctx()),
        {
          name: "DocsError",
          message: 'install.md: the "# " heading must be followed by a paragraph that describes the page',
        },
        source,
      );
    }
  });

  it("names the page and the reason in its errors", () => {
    assert.throws(
      () => page("> [!DANGER]\n> Hi.\n"),
      (error) =>
        error instanceof DocsError &&
        error.file === "install.md" &&
        error.reason === "unknown alert type [!DANGER]" &&
        error.message === "install.md: unknown alert type [!DANGER]",
    );
  });

  it("escapes characters MDX would read as syntax", () => {
    const out = page("Braces {x} stay text; `{code}` and `<name>` stay code.\n");
    assert.match(out.body, /Braces \\\{x}/);
    assert.match(out.body, /`\{code}` and `<name>`/);
  });

  it("writes bare URLs as resource links, since MDX has no autolinks", () => {
    assert.match(page("See https://example.com.\n").body, /\[https:\/\/example\.com]\(https:\/\/example\.com\)/);
  });

  it("rejects raw HTML and drops comments", () => {
    assert.throws(() => page("Run with <name> here.\n"), /raw HTML "<name>"/);
    assert.doesNotMatch(page("<!-- note -->\n\nText.\n").body, /note/);
  });

  it("imports exactly the components it uses", () => {
    assert.doesNotMatch(page("Plain.\n").body, /import/);
    assert.match(
      page("> [!TIP]\n> Hi.\n").body,
      /^import \{ Aside \} from "@astrojs\/starlight\/components";/,
    );
  });
});

describe("alerts", () => {
  it("become asides with GitHub's labels", () => {
    for (const [marker, type, title] of [
      ["NOTE", "note", "Note"],
      ["TIP", "tip", "Tip"],
      ["IMPORTANT", "note", "Important"],
      ["WARNING", "caution", "Warning"],
      ["CAUTION", "danger", "Caution"],
    ]) {
      const out = page(`> [!${marker}]\n> Body **text**.\n`);
      assert.match(out.body, new RegExp(`<Aside type="${type}" title="${title}">\\n  Body \\*\\*text\\*\\*\\.\\n</Aside>`));
    }
  });

  it("keep later paragraphs", () => {
    const out = page("> [!NOTE]\n> One.\n>\n> Two.\n");
    assert.match(out.body, /<Aside[^>]*>\n  One\.\n\n  Two\.\n<\/Aside>/);
  });

  it("need the marker on its own line, as on GitHub", () => {
    const out = page("> [!NOTE] Inline.\n");
    assert.doesNotMatch(out.body, /Aside/);
    assert.match(out.body, /^> \\\[!NOTE] Inline\./m);
  });

  it("reject unknown types", () => {
    assert.throws(() => page("> [!DANGER]\n> Hi.\n"), /unknown alert type \[!DANGER]/);
  });
});

describe("steps", () => {
  it("wrap an ordered list whose items contain code", () => {
    const out = page("1. Run:\n\n   ```sh\n   make\n   ```\n\n2. Done.\n");
    assert.match(out.body, /<Steps>\n  1\. Run:\n\n     ```sh\n     make\n     ```\n\n  2\. Done\.\n<\/Steps>/);
  });

  it("leave other ordered lists alone", () => {
    assert.doesNotMatch(page("1. One.\n2. Two.\n").body, /Steps/);
  });
});

describe("tabs", () => {
  const source = [
    "Intro.",
    "",
    "With Go:",
    "",
    '```sh tab="go install"',
    "go install x@latest",
    "```",
    "",
    'Or a binary, then verify it with:',
    "",
    '```sh tab="Binary" title="verify"',
    "gh attestation verify",
    "```",
    "",
    "After.",
    "",
  ].join("\n");

  it("group adjacent tab fences, taking colon lead-ins into their tab", () => {
    const out = page(source);
    assert.match(out.body, /^Intro\.$/m);
    assert.match(out.body, /<Tabs syncKey="git-inlay:Binary\|go install">/);
    assert.match(out.body, /<TabItem label="go install">\n    With Go:\n\n    ```sh\n    go install/);
    assert.match(out.body, /<TabItem label="Binary">\n    Or a binary, then verify it with:\n\n    ```sh title="verify"\n/);
    assert.match(out.body, /<\/Tabs>\n\nAfter\./);
    assert.doesNotMatch(out.body, /tab=/);
  });

  it("reject a lone tab fence", () => {
    assert.throws(() => page('```sh tab="One"\nx\n```\n'), /needs an adjacent tab fence/);
  });

  it("reject duplicate labels", () => {
    assert.throws(
      () => page('```sh tab="A"\nx\n```\n\n```sh tab="A"\ny\n```\n'),
      /duplicate tab labels/,
    );
  });

  it("leave fences without a tab alone", () => {
    const out = page('```json title="a.json"\n{}\n```\n');
    assert.doesNotMatch(out.body, /Tabs/);
    assert.match(out.body, /```json title="a.json"/);
  });
});

describe("tree fences", () => {
  it("become a nested file tree with comments", () => {
    const out = page("```tree\nsrc/\n  main.go    entry   point\n  lib/\n    a.go\nREADME.md\n```\n");
    assert.match(
      out.body,
      /<FileTree>\n  - src\/\n    - main\.go entry point\n    - lib\/\n      - a\.go\n  - README\.md\n<\/FileTree>/,
    );
  });
});

describe("resolveUrl", () => {
  it("routes docs pages, keeping the fragment", () => {
    assert.equal(resolveUrl("guards.md#bypasses", ctx()), "/git-inlay/guards/#bypasses");
    assert.equal(resolveUrl("./README.md", ctx()), "/git-inlay/");
  });

  it("links other repository files and directories on GitHub at the ref", () => {
    assert.equal(resolveUrl("../PLAN.md", ctx()), "https://github.com/acycl/git-inlay/blob/v1.0.0/PLAN.md");
    assert.equal(resolveUrl("../internal/", ctx()), "https://github.com/acycl/git-inlay/tree/v1.0.0/internal");
    assert.equal(resolveUrl("diagram.svg", ctx()), "https://github.com/acycl/git-inlay/blob/v1.0.0/docs/diagram.svg");
  });

  it("leaves absolute URLs and fragments alone", () => {
    for (const url of ["https://x.dev/a", "mailto:a@b.c", "/abs", "#here"]) {
      assert.equal(resolveUrl(url, ctx()), url);
    }
  });

  it("rejects missing targets, escapes, and badly named pages", () => {
    assert.throws(() => resolveUrl("nope.md", ctx()), /link to missing docs\/nope\.md/);
    assert.throws(() => resolveUrl("../../x", ctx()), /leaves the repository/);
    assert.throws(() => resolveUrl("Bad_Name.md", ctx()), /lowercase kebab-case/);
  });

  it("rewrites reference definitions", () => {
    assert.match(page("See [guards][g].\n\n[g]: guards.md\n").body, /\[g]: \/git-inlay\/guards\//);
  });

  it("rejects links from the site root and to local servers, as the site's link validator does", () => {
    assert.throws(() => page("See [the license](/LICENSE).\n"), {
      message:
        'install.md: link /LICENSE starts with "/"; use a relative path to a file in the repository, or a full URL',
    });
    assert.throws(() => page("See [x][d].\n\n[d]: //example.com/x\n"), /link \/\/example\.com\/x starts with "\/"/);
    assert.throws(
      () => page("Open http://localhost:4321 to see it.\n"),
      /link http:\/\/localhost:4321 points at a local server, which the site refuses; put it in backticks/,
    );
    assert.throws(() => page("[API](http://127.0.0.1:8080/v1)\n"), /points at a local server/);
    assert.throws(
      () => page("![Shot][app] and [open it][app].\n\n[app]: http://localhost:3000/a.png\n"),
      /points at a local server/,
    );
    assert.match(
      page("Open `http://localhost:4321`, or https://localhost.example.com.\n").body,
      /\(https:\/\/localhost\.example\.com\)/,
    );
  });

  it("rejects relative images, inline or by reference", () => {
    assert.throws(() => page("![d](diagram.svg)\n"), /relative image diagram\.svg/);
    assert.throws(() => page("![d][x]\n\n[x]: diagram.svg\n"), /relative image diagram\.svg/);
    assert.match(page("![d][x]\n\n[x]: https://x.dev/d.svg\n").body, /\[x]: https:\/\/x\.dev\/d\.svg/);
  });
});

describe("convertIndex", () => {
  const index = [
    "# git-inlay",
    "",
    "Keep private files tracked.",
    "",
    "An **inlay** is a repository.",
    "",
    "## Start here",
    "",
    "- [Install](install.md) — get the binary",
    "- [Guards](guards.md): what the hooks refuse",
    "",
    "## Design",
    "",
    "See [`PLAN.md`](../PLAN.md).",
    "",
  ].join("\n");

  it("turns the lead into the tagline and link lists into cards and sidebar groups", () => {
    const out = convertIndex(index, ctx("README.md"));
    assert.equal(out.title, "git-inlay");
    assert.equal(out.tagline, "Keep private files tracked.");
    assert.deepEqual(out.pages, ["install.md", "guards.md"]);
    assert.deepEqual(out.sidebar, [
      {
        label: "Start here",
        items: [
          { label: "Install", link: "/git-inlay/install/" },
          { label: "Guards", link: "/git-inlay/guards/" },
        ],
      },
    ]);
    assert.doesNotMatch(out.body, /Keep private files tracked/);
    assert.match(out.body, /^An \*\*inlay\*\* is a repository\./m);
    assert.match(out.body, /<LinkCard title=\{"Install"} href="\/git-inlay\/install\/" description=\{"get the binary"} \/>/);
    assert.match(out.body, /<LinkCard title=\{"Guards"} href="\/git-inlay\/guards\/" description=\{"what the hooks refuse"} \/>/);
    assert.match(out.body, /\[`PLAN.md`]\(https:\/\/github\.com\/acycl\/git-inlay\/blob\/v1\.0\.0\/PLAN\.md\)/);
  });

  it("escapes card text, which Starlight renders as HTML", () => {
    const out = convertIndex(
      "# T\n\nTagline.\n\n- [`<b>` & co](install.md) — run `<name>` \"now\"\n",
      ctx("README.md"),
    );
    assert.match(
      out.body,
      /title=\{"&lt;b&gt; &amp; co"} href="\/git-inlay\/install\/" description=\{"run &lt;name&gt; &quot;now&quot;"}/,
    );
  });

  it("keeps lists that are not all page links", () => {
    const out = convertIndex("# T\n\nTagline.\n\n- [Install](install.md)\n- plain item\n", ctx("README.md"));
    assert.deepEqual(out.pages, []);
    assert.doesNotMatch(out.body, /CardGrid/);
  });

  it("rejects an index without a tagline", () => {
    assert.throws(
      () => convertIndex("# T\n\n## Start here\n\n- [Install](install.md)\n", ctx("README.md")),
      { message: /^README\.md: the "# " heading must be followed by a paragraph/ },
    );
  });

  it("rejects an index entry for a missing page", () => {
    assert.throws(
      () => convertIndex("# T\n\nTagline.\n\n- [Gone](gone.md)\n", ctx("README.md")),
      /index lists missing page gone\.md/,
    );
  });
});

describe("escapeHtml", () => {
  it("escapes markup and quotes", () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("pageRoute", () => {
  it("maps README to the project root", () => {
    assert.equal(pageRoute("p", "README.md"), "/p/");
    assert.equal(pageRoute("p", "day-to-day.md"), "/p/day-to-day/");
  });
});

describe("frontmatter", () => {
  it("writes JSON values, bare dates, and skips undefined", () => {
    assert.equal(
      frontmatter({
        title: 'Say "hi"',
        description: undefined,
        lastUpdated: new Date("2026-11-09T12:00:00Z"),
        hero: { actions: [{ text: "Go" }] },
      }),
      '---\ntitle: "Say \\"hi\\""\nlastUpdated: 2026-11-09T12:00:00.000Z\nhero: {"actions":[{"text":"Go"}]}\n---\n',
    );
  });
});
