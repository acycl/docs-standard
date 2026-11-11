// @ts-check
/**
 * Converts a project's whole docs directory and applies the rules that
 * span pages: the directory has an index, `README.md`, that lists every
 * other page exactly once.
 *
 * Problems are collected rather than thrown, so one run reports every
 * page that the site would refuse.
 */
import fs from "node:fs";
import path from "node:path";
import {
  DocsError,
  PAGE_NAME,
  convertIndex,
  convertPage,
} from "./transform.mjs";

/**
 * @typedef {import("./transform.mjs").ConvertedIndex} ConvertedIndex
 * @typedef {import("./transform.mjs").ConvertedPage} ConvertedPage
 * @typedef {import("./transform.mjs").PageContext} PageContext
 */

/**
 * A project's docs directory and where the site publishes it.
 *
 * @typedef {object} DocsSource
 * @property {string} root Repository directory on disk.
 * @property {string} docsDir Docs directory relative to `root`, with `/`
 *   separators, e.g. `docs`. It must exist.
 * @property {string} slug URL slug of the project, e.g. `git-inlay`.
 * @property {string} repo GitHub repository, `owner/name`.
 * @property {string} ref Commit or tag the docs are built from, used in
 *   links to other files in the repository.
 */

/**
 * A docs directory converted to MDX.
 *
 * @typedef {object} ConvertedDocs
 * @property {ConvertedIndex | undefined} index The index, unless it is
 *   missing or failed to convert.
 * @property {Map<string, ConvertedPage>} pages Every other page that
 *   converted, by docs-relative path, listed or not.
 * @property {DocsError[]} errors Every problem found: the index's first,
 *   then each page's in file name order. The site publishes the docs only
 *   when there are none.
 */

/** How the index has to list a page, for error messages. */
const LIST_PAGES = "list each page in a bulleted list as `- [Title](page.md) — summary`";

/**
 * Converts the index and every page of a docs directory.
 *
 * @param {DocsSource} source
 * @returns {ConvertedDocs}
 */
export function convertDocs(source) {
  const docsRoot = path.join(source.root, source.docsDir);
  const files = fs
    .readdirSync(docsRoot)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort();

  /** @param {string} repoPath */
  const stat = (repoPath) => {
    try {
      return fs.statSync(path.join(source.root, repoPath)).isDirectory() ? "dir" : "file";
    } catch {
      return undefined;
    }
  };
  /**
   * @param {string} file
   * @returns {PageContext}
   */
  const context = (file) => ({
    slug: source.slug,
    repo: source.repo,
    ref: source.ref,
    docsDir: source.docsDir,
    file,
    stat,
  });
  /** @param {string} file */
  const read = (file) => fs.readFileSync(path.join(docsRoot, file), "utf8");

  /** @type {DocsError[]} */
  const errors = [];
  /** @type {ConvertedIndex | undefined} */
  let index;
  if (stat(path.posix.join(source.docsDir, "README.md")) !== "file") {
    errors.push(new DocsError("README.md", `the index is missing; create it and ${LIST_PAGES}`));
  } else {
    try {
      index = convertIndex(read("README.md"), context("README.md"));
      errors.push(...checkListing(index.pages, files));
    } catch (error) {
      errors.push(asDocsError("README.md", error));
    }
  }

  /** @type {Map<string, ConvertedPage>} */
  const pages = new Map();
  for (const file of files) {
    if (!PAGE_NAME.test(file)) {
      errors.push(
        new DocsError(file, "page file names are lowercase kebab-case, such as day-to-day.md"),
      );
    }
    try {
      pages.set(file, convertPage(read(file), context(file)));
    } catch (error) {
      errors.push(asDocsError(file, error));
    }
  }
  return { index, pages, errors };
}

/**
 * Checks that the index lists each page exactly once.
 *
 * @param {string[]} listed Pages the index lists, in order.
 * @param {string[]} files Pages in the docs directory, other than the
 *   index.
 * @returns {DocsError[]}
 */
function checkListing(listed, files) {
  if (!listed.length) {
    return [new DocsError("README.md", `lists no pages; ${LIST_PAGES}`)];
  }
  const errors = [];
  const twice = new Set(listed.filter((page, i) => listed.indexOf(page) !== i));
  if (twice.size) {
    errors.push(new DocsError("README.md", `lists ${[...twice].join(", ")} more than once`));
  }
  const unlisted = files.filter((file) => !listed.includes(file));
  if (unlisted.length) {
    errors.push(new DocsError("README.md", `does not list ${unlisted.join(", ")}; ${LIST_PAGES}`));
  }
  return errors;
}

/**
 * Returns a thrown value as a `DocsError` for the file being converted,
 * keeping any other error as its cause.
 *
 * @param {string} file
 * @param {unknown} error
 */
function asDocsError(file, error) {
  if (error instanceof DocsError) return error;
  return new DocsError(file, error instanceof Error ? error.message : String(error), {
    cause: error,
  });
}
