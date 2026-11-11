/**
 * Converts the index and every page of a docs directory.
 *
 * @param {DocsSource} source
 * @returns {ConvertedDocs}
 */
export function convertDocs(source: DocsSource): ConvertedDocs;
export type ConvertedIndex = import("./transform.mjs").ConvertedIndex;
export type ConvertedPage = import("./transform.mjs").ConvertedPage;
export type PageContext = import("./transform.mjs").PageContext;
/**
 * A project's docs directory and where the site publishes it.
 */
export type DocsSource = {
    /**
     * Repository directory on disk.
     */
    root: string;
    /**
     * Docs directory relative to `root`, with `/`
     * separators, e.g. `docs`. It must exist.
     */
    docsDir: string;
    /**
     * URL slug of the project, e.g. `git-inlay`.
     */
    slug: string;
    /**
     * GitHub repository, `owner/name`.
     */
    repo: string;
    /**
     * Commit or tag the docs are built from, used in
     * links to other files in the repository.
     */
    ref: string;
};
/**
 * A docs directory converted to MDX.
 */
export type ConvertedDocs = {
    /**
     * The index, unless it is
     * missing or failed to convert.
     */
    index: ConvertedIndex | undefined;
    /**
     * Every other page that
     * converted, by docs-relative path, listed or not.
     */
    pages: Map<string, ConvertedPage>;
    /**
     * Every problem found: the index's first,
     * then each page's in file name order. The site publishes the docs only
     * when there are none.
     */
    errors: DocsError[];
};
import { DocsError } from "./transform.mjs";
