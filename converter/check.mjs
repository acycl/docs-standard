#!/usr/bin/env node
// @ts-check
/**
 * Checks a project's docs with the converter acycl.dev runs, writing
 * nothing: the index must exist and list every page exactly once, and
 * every page must convert and have a description.
 *
 * Usage: docs-standard-check [repository [docs]]
 *
 * `repository` is the repository directory, `.` by default, and `docs` is
 * the docs directory within it, `docs` by default. Every problem is
 * printed, one per line. The exit status is 0 when there are none, 1 when
 * there are, and 2 for a usage error. Under GitHub Actions each problem is
 * printed as an error annotation on its file instead.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { convertDocs } from "./docs.mjs";

const USAGE = "usage: docs-standard-check [repository [docs]]";

/**
 * Where the check writes, and the environment it reads.
 *
 * @typedef {object} CheckIO
 * @property {(line: string) => void} out Writes a line of the report.
 * @property {(line: string) => void} err Writes a usage error.
 * @property {Record<string, string | undefined>} env Environment
 *   variables.
 */

/**
 * Runs the check and returns its exit status.
 *
 * @param {string[]} args Command-line arguments, after the script name.
 * @param {CheckIO} io
 * @returns {number}
 */
export function main(args, { out, err, env }) {
  /** @type {string[]} */
  let positionals;
  try {
    const parsed = parseArgs({
      args,
      allowPositionals: true,
      options: { help: { type: "boolean", short: "h" } },
    });
    if (parsed.values.help) {
      out(USAGE);
      return 0;
    }
    positionals = parsed.positionals;
  } catch (error) {
    err(`${/** @type {Error} */ (error).message}\n${USAGE}`);
    return 2;
  }
  if (positionals.length > 2) {
    err(USAGE);
    return 2;
  }
  const [root = ".", docs = "docs"] = positionals;
  const docsDir = path.posix.normalize(docs);
  if (path.posix.isAbsolute(docsDir) || docsDir.split("/")[0] === "..") {
    err(`docs directory ${docs} must be a relative path inside the repository`);
    return 2;
  }
  const docsRoot = path.join(root, docsDir);
  if (!fs.statSync(docsRoot, { throwIfNoEntry: false })?.isDirectory()) {
    err(`${docsRoot}: no such directory`);
    return 2;
  }

  // The check discards the converted pages, so the routes and GitHub links
  // they are built with need no real values.
  const { pages, errors } = convertDocs({
    root,
    docsDir,
    slug: "project",
    repo: "owner/project",
    ref: "HEAD",
  });
  if (!errors.length) {
    out(`${docsRoot}: the index and ${plural(pages.size, "page")} pass`);
    return 0;
  }
  const annotate = env.GITHUB_ACTIONS === "true";
  for (const error of errors) {
    const file = path.join(docsRoot, error.file);
    const line = `${file}: ${error.reason}`;
    out(annotate ? `::error file=${escapeProperty(file)}::${escapeData(line)}` : line);
  }
  out(`${docsRoot}: ${plural(errors.length, "problem")}`);
  return 1;
}

/**
 * Returns a count and a noun, made plural unless the count is one.
 *
 * @param {number} count
 * @param {string} noun
 */
function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Escapes the message of a GitHub Actions workflow command.
 *
 * @param {string} text
 */
function escapeData(text) {
  return text.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

/**
 * Escapes a property value of a GitHub Actions workflow command.
 *
 * @param {string} text
 */
function escapeProperty(text) {
  return escapeData(text).replaceAll(":", "%3A").replaceAll(",", "%2C");
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2), {
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    env: process.env,
  });
}
