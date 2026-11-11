export type Root = import("mdast").Root;
export type Node = import("mdast").Nodes;
export type Parent = import("mdast").Parent;
export type Content = import("mdast").RootContent;
export type Code = import("mdast").Code;
export type List = import("mdast").List;
export type ListItem = import("mdast").ListItem;
export type Paragraph = import("mdast").Paragraph;
export type PageContext = {
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
    /**
     * Docs directory relative to the repository
     * root, e.g. `docs`.
     */
    docsDir: string;
    /**
     * Page path relative to `docsDir`, e.g.
     * `guards.md`.
     */
    file: string;
    /**
     *   Reports whether a repository-relative path is a file, a directory,
     *   or missing.
     */
    stat: (repoPath: string) => "file" | "dir" | undefined;
};
export type ConvertedPage = {
    /**
     * Text of the page's `#` heading.
     */
    title: string;
    /**
     * Plain text of the paragraph right after
     * the title.
     */
    description: string;
    /**
     * MDX body, without front matter.
     */
    body: string;
};
export type SidebarEntry = {
    label: string;
    link: string;
} | {
    label: string;
    items: SidebarEntry[];
};
export type ConvertedIndex = {
    /**
     * Text of the index's `#` heading.
     */
    title: string;
    /**
     * Plain text of the paragraph right after the
     * title, shown in the hero.
     */
    tagline: string;
    /**
     * MDX body, without front matter.
     */
    body: string;
    /**
     * Pages in the order the index lists
     * them, grouped under the index's `##` headings.
     */
    sidebar: SidebarEntry[];
    /**
     * Docs-relative paths of every page the index
     * lists, in order.
     */
    pages: string[];
};
/**
 * @typedef {import("mdast").Root} Root
 * @typedef {import("mdast").Nodes} Node
 * @typedef {import("mdast").Parent} Parent
 * @typedef {import("mdast").RootContent} Content
 * @typedef {import("mdast").Code} Code
 * @typedef {import("mdast").List} List
 * @typedef {import("mdast").ListItem} ListItem
 * @typedef {import("mdast").Paragraph} Paragraph
 */
/**
 * Where a page lives and how to resolve the paths it links to.
 *
 * @typedef {object} PageContext
 * @property {string} slug URL slug of the project, e.g. `git-inlay`.
 * @property {string} repo GitHub repository, `owner/name`.
 * @property {string} ref Commit or tag the docs are built from, used in
 *   links to other files in the repository.
 * @property {string} docsDir Docs directory relative to the repository
 *   root, e.g. `docs`.
 * @property {string} file Page path relative to `docsDir`, e.g.
 *   `guards.md`.
 * @property {(repoPath: string) => "file" | "dir" | undefined} stat
 *   Reports whether a repository-relative path is a file, a directory,
 *   or missing.
 */
/**
 * A page converted to MDX.
 *
 * @typedef {object} ConvertedPage
 * @property {string} title Text of the page's `#` heading.
 * @property {string} description Plain text of the paragraph right after
 *   the title.
 * @property {string} body MDX body, without front matter.
 */
/**
 * One sidebar entry: a link to a page, or a labelled group of entries.
 *
 * @typedef {{ label: string, link: string } | { label: string, items: SidebarEntry[] }} SidebarEntry
 */
/**
 * The project index converted to a splash page.
 *
 * @typedef {object} ConvertedIndex
 * @property {string} title Text of the index's `#` heading.
 * @property {string} tagline Plain text of the paragraph right after the
 *   title, shown in the hero.
 * @property {string} body MDX body, without front matter.
 * @property {SidebarEntry[]} sidebar Pages in the order the index lists
 *   them, grouped under the index's `##` headings.
 * @property {string[]} pages Docs-relative paths of every page the index
 *   lists, in order.
 */
/**
 * A problem in a docs page that keeps it off the site. The message is
 * `file: reason`.
 */
export declare class DocsError extends Error {
    file: string;
    reason: string;
    /**
     * @param {string} file Page path relative to the docs directory, e.g.
     *   `guards.md`.
     * @param {string} reason What is wrong, without the file name.
     * @param {ErrorOptions} [options]
     */
    constructor(file: string, reason: string, options?: ErrorOptions);
}
/** A docs page's file name: lowercase kebab-case. */
export declare const PAGE_NAME: RegExp;
/**
 * Converts one docs page.
 *
 * @param {string} markdown Page source.
 * @param {PageContext} ctx Where the page lives.
 * @returns {ConvertedPage}
 */
export declare function convertPage(markdown: string, ctx: PageContext): ConvertedPage;
/**
 * Converts the project index: its title and lead paragraph become the
 * hero, and each list of page links becomes a grid of link cards and a
 * sidebar group named by the `##` heading above it.
 *
 * @param {string} markdown Index source.
 * @param {PageContext} ctx Where the index lives.
 * @returns {ConvertedIndex}
 */
export declare function convertIndex(markdown: string, ctx: PageContext): ConvertedIndex;
/**
 * Returns the route of a docs page.
 *
 * @param {string} slug Project slug.
 * @param {string} page Docs-relative page path, e.g. `guards.md`.
 */
export declare function pageRoute(slug: string, page: string): string;
export type References = {
    images: Set<string>;
    links: Set<string>;
};
/**
 * Resolves a link URL found in a page. Absolute URLs and fragments are
 * returned unchanged. Relative URLs that name a docs page become its
 * route; any other file or directory in the repository becomes a GitHub
 * link at the docs ref.
 *
 * @param {string} url
 * @param {PageContext} ctx
 */
export declare function resolveUrl(url: string, ctx: PageContext): string;
/**
 * Escapes text for a context that renders it as HTML, such as Starlight's
 * hero and link cards.
 *
 * @param {string} text
 */
export declare function escapeHtml(text: string): string;
/**
 * Renders front matter. Values are written as JSON, which YAML reads
 * as-is; dates are written as bare ISO timestamps so YAML parses them as
 * dates.
 *
 * @param {Record<string, unknown>} fields
 */
export declare function frontmatter(fields: Record<string, unknown>): string;
