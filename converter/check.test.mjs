// @ts-check
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { main } from "./check.mjs";

/** @type {string[]} */
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Writes files into a new temporary directory and returns it.
 *
 * @param {Record<string, string>} files Contents by repository-relative
 *   path.
 */
function repository(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-standard-"));
  made.push(root);
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}

/**
 * Runs the check and returns its exit status and output.
 *
 * @param {string[]} args
 * @param {Record<string, string>} [env]
 */
function run(args, env = {}) {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const err = [];
  const status = main(args, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    env,
  });
  return { status, out, err };
}

const INDEX = "# P\n\nAbout P.\n\n- [Install](install.md) — get it\n";

describe("docs-standard-check", () => {
  it("passes conforming docs", () => {
    const root = repository({ "docs/README.md": INDEX, "docs/install.md": "# Install\n\nGet P.\n" });
    assert.deepEqual(run([root]), {
      status: 0,
      out: [`${path.join(root, "docs")}: the index and 1 page pass`],
      err: [],
    });
  });

  it("reads the docs directory it is given", () => {
    const root = repository({ "manual/README.md": INDEX, "manual/install.md": "# Install\n\nGet P.\n" });
    assert.equal(run([root, "manual/"]).status, 0);
  });

  it("reports every problem, with its file, and fails", () => {
    const root = repository({
      "docs/README.md": INDEX,
      "docs/install.md": "# Install\n",
      "docs/extra.md": "# Extra\n\nMore.\n\n> [!DANGER]\n> No.\n",
    });
    const docs = path.join(root, "docs");
    assert.deepEqual(run([root]), {
      status: 1,
      out: [
        `${docs}/README.md: does not list extra.md; list each page in a bulleted list as \`- [Title](page.md) — summary\``,
        `${docs}/extra.md: unknown alert type [!DANGER]`,
        `${docs}/install.md: the "# " heading must be followed by a paragraph that describes the page`,
        `${docs}: 3 problems`,
      ],
      err: [],
    });
  });

  it("annotates each problem's file under GitHub Actions", () => {
    const root = repository({
      "docs/README.md": INDEX,
      "docs/install.md": "# Install\n\nSee [the notes](50%25.md).\n",
    });
    const file = path.join(root, "docs", "install.md");
    const { status, out } = run([root], { GITHUB_ACTIONS: "true" });
    assert.equal(status, 1);
    assert.equal(out[0], `::error file=${file}::${file}: link to missing docs/50%25.md`);
  });

  it("rejects bad usage", () => {
    const root = repository({ "docs/README.md": INDEX });
    for (const args of [["--nope"], [root, "docs", "extra"], [root, "../docs"], [root, "/docs"], [root, "missing"]]) {
      const { status, out, err } = run(args);
      assert.equal(status, 2, args.join(" "));
      assert.deepEqual(out, []);
      assert.equal(err.length, 1);
    }
    assert.match(run(["--help"]).out[0], /^usage: docs-standard-check/);
  });
});
