// @ts-check
/**
 * The converter acycl.dev runs on each project's docs, as a package the
 * site and the conformance check share.
 *
 * - `convertDocs` converts a whole docs directory and reports every
 *   problem in it.
 * - `convertIndex` and `convertPage` convert one file.
 * - The rest are helpers the site uses to write the converted pages.
 */
export { convertDocs } from "./docs.mjs";
export {
  DocsError,
  convertIndex,
  convertPage,
  escapeHtml,
  frontmatter,
  pageRoute,
  resolveUrl,
} from "./transform.mjs";

/**
 * @typedef {import("./docs.mjs").ConvertedDocs} ConvertedDocs
 * @typedef {import("./docs.mjs").DocsSource} DocsSource
 * @typedef {import("./transform.mjs").ConvertedIndex} ConvertedIndex
 * @typedef {import("./transform.mjs").ConvertedPage} ConvertedPage
 * @typedef {import("./transform.mjs").PageContext} PageContext
 * @typedef {import("./transform.mjs").SidebarEntry} SidebarEntry
 */
