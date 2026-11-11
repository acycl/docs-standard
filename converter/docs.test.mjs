// @ts-check
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { convertDocs } from "./docs.mjs";
import { DocsError } from "./transform.mjs";

/** @type {string[]} */
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** A small repository whose docs follow the standard. */
const CONFORMING = {
  "README.md": "# P\n",
  "docs/README.md": [
    "# P documentation",
    "",
    "About P.",
    "",
    "## Guides",
    "",
    "- [Install](install.md) — get it",
    "- [Use](use.md) — use it",
    "",
    "See the [readme](../README.md).",
    "",
  ].join("\n"),
  "docs/install.md": "# Install\n\nGet P.\n\n> [!TIP]\n> Fast.\n\nThen [use it](use.md#run).\n",
  "docs/use.md": "# Use\n\nUse P.\n\n## Run\n\nRun it.\n",
};

/**
 * Writes files into a new temporary directory and converts its docs.
 *
 * @param {Record<string, string | null>} files Contents by
 *   repository-relative path; `null` leaves a file out, and a path ending
 *   in `/` is made as a directory.
 */
function convert(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-standard-"));
  made.push(root);
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    const file = path.join(root, name);
    if (name.endsWith("/")) {
      fs.mkdirSync(file, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return convertDocs({ root, docsDir: "docs", slug: "p", repo: "acycl/p", ref: "v1.0.0" });
}

/**
 * Returns the messages of the errors a conversion reported.
 *
 * @param {ReturnType<typeof convertDocs>} docs
 */
const messages = (docs) => docs.errors.map((error) => error.message);

describe("convertDocs", () => {
  it("converts the index and every page", () => {
    const docs = convert(CONFORMING);
    assert.deepEqual(docs.errors, []);
    assert.equal(docs.index?.tagline, "About P.");
    assert.deepEqual(docs.index?.pages, ["install.md", "use.md"]);
    assert.deepEqual([...docs.pages.keys()], ["install.md", "use.md"]);
    assert.equal(docs.pages.get("install.md")?.description, "Get P.");
    assert.match(docs.pages.get("install.md")?.body ?? "", /\(\/p\/use\/#run\)/);
  });

  it("reports every failing page, not only the first", () => {
    const docs = convert({
      ...CONFORMING,
      "docs/install.md": "# Install\n\n## Steps\n\nGet P.\n",
      "docs/use.md": "# Use\n\nRun <name>.\n",
    });
    assert.deepEqual(messages(docs), [
      'install.md: the "# " heading must be followed by a paragraph that describes the page',
      'use.md: raw HTML "<name>" is not supported; put it in backticks',
    ]);
    assert.ok(docs.errors.every((error) => error instanceof DocsError));
    assert.ok(docs.index);
  });

  it("rejects a page the index does not list, and still converts it", () => {
    const docs = convert({ ...CONFORMING, "docs/extra.md": "# Extra\n\nMore.\n" });
    assert.deepEqual(messages(docs), [
      "README.md: does not list extra.md; list each page in a bulleted list as `- [Title](page.md) — summary`",
    ]);
    assert.ok(docs.pages.has("extra.md"));
  });

  it("rejects a page listed twice", () => {
    const docs = convert({
      ...CONFORMING,
      "docs/README.md": "# P\n\nAbout P.\n\n- [Install](install.md)\n- [Use](use.md)\n\n## Again\n\n- [Install](install.md)\n",
    });
    assert.deepEqual(messages(docs), ["README.md: lists install.md more than once"]);
  });

  it("rejects an index that lists pages in a table", () => {
    const docs = convert({
      ...CONFORMING,
      "docs/README.md": "# P\n\nAbout P.\n\n| Page | About |\n| --- | --- |\n| [Install](install.md) | Get it |\n| [Use](use.md) | Use it |\n",
    });
    assert.deepEqual(messages(docs), [
      "README.md: lists no pages; list each page in a bulleted list as `- [Title](page.md) — summary`",
    ]);
  });

  it("rejects a missing index, and still converts the pages", () => {
    const docs = convert({ ...CONFORMING, "docs/README.md": null, "docs/use.md": "# Use\n" });
    assert.deepEqual(messages(docs), [
      "README.md: the index is missing; create it and list each page in a bulleted list as `- [Title](page.md) — summary`",
      'use.md: the "# " heading must be followed by a paragraph that describes the page',
    ]);
    assert.equal(docs.index, undefined);
    assert.ok(docs.pages.has("install.md"));
  });

  it("reports an index that fails to convert, without checking its listing", () => {
    const docs = convert({
      ...CONFORMING,
      "docs/README.md": "# P\n\nAbout P.\n\n- [Gone](gone.md)\n",
    });
    assert.deepEqual(messages(docs), ["README.md: index lists missing page gone.md"]);
  });

  it("rejects a page file name that is not lowercase kebab-case", () => {
    const docs = convert({ ...CONFORMING, "docs/Day_To_Day.md": "# Day to day\n\nWork.\n" });
    assert.deepEqual(messages(docs), [
      "README.md: does not list Day_To_Day.md; list each page in a bulleted list as `- [Title](page.md) — summary`",
      "Day_To_Day.md: page file names are lowercase kebab-case, such as day-to-day.md",
    ]);
  });

  it("names the page in any other error, keeping it as the cause", () => {
    const docs = convert({ ...CONFORMING, "docs/odd.md/": "" });
    const error = docs.errors.find((e) => e.file === "odd.md");
    assert.ok(error?.cause instanceof Error);
    assert.match(error.message, /^odd\.md: EISDIR/);
  });
});
