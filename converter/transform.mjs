// @ts-check
/**
 * Converts a project's GitHub-flavoured Markdown docs into Starlight MDX.
 *
 * The source stays plain Markdown that reads well on GitHub; these
 * transforms apply Starlight's components where the Markdown already says
 * what something is:
 *
 * - GitHub alerts (`> [!NOTE]`) become `<Aside>`.
 * - An ordered list whose items contain code blocks becomes `<Steps>`.
 * - Adjacent code fences with `tab="…"` in their info string become
 *   `<Tabs>`. A paragraph ending in a colon right before such a fence is
 *   that tab's lead-in and moves into the tab with it.
 * - A ` ```tree ` fence becomes `<FileTree>`.
 * - Relative links resolve to site routes for pages in the docs directory
 *   and to GitHub for any other file in the repository.
 * - The index (`README.md`) becomes a splash page whose `##` groups of
 *   link lists become card grids and the project's sidebar.
 *
 * Every function here is pure: callers pass the Markdown and a context,
 * and get MDX back. Markdown the site cannot render is rejected with a
 * `DocsError` naming the page.
 */
import path from "node:path/posix";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

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
export class DocsError extends Error {
  /**
   * @param {string} file Page path relative to the docs directory, e.g.
   *   `guards.md`.
   * @param {string} reason What is wrong, without the file name.
   * @param {ErrorOptions} [options]
   */
  constructor(file, reason, options) {
    super(`${file}: ${reason}`, options);
    this.name = "DocsError";
    this.file = file;
    this.reason = reason;
  }
}

/** GitHub alert types and the Starlight aside each becomes. */
const ALERTS = new Map([
  ["NOTE", { type: "note", title: "Note" }],
  ["TIP", { type: "tip", title: "Tip" }],
  ["IMPORTANT", { type: "note", title: "Important" }],
  ["WARNING", { type: "caution", title: "Warning" }],
  ["CAUTION", { type: "danger", title: "Caution" }],
]);

const ALERT_MARKER = /^\[!([A-Za-z]+)\][ \t]*(?:\r?\n|$)/;
const TAB_META = /(?:^|\s)tab="([^"]*)"/;
/** A docs page's file name: lowercase kebab-case. */
export const PAGE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LINK_SEPARATOR = /^\s*(?:—|–|-|:)\s*/;

const parser = unified().use(remarkParse).use(remarkGfm);
const serializer = unified()
  .use(remarkGfm)
  .use(remarkMdx)
  .use(remarkStringify, {
    bullet: "-",
    emphasis: "_",
    fences: true,
    rule: "-",
    // MDX has no `<url>` autolinks, so always write `[text](url)`.
    resourceLink: true,
  });

/**
 * Converts one docs page.
 *
 * @param {string} markdown Page source.
 * @param {PageContext} ctx Where the page lives.
 * @returns {ConvertedPage}
 */
export function convertPage(markdown, ctx) {
  const tree = parser.parse(markdown);
  const title = takeTitle(tree, ctx.file);
  const description = leadParagraph(tree, ctx.file);
  prepare(tree, ctx);
  return { title, description, body: serialize(tree) };
}

/**
 * Converts the project index: its title and lead paragraph become the
 * hero, and each list of page links becomes a grid of link cards and a
 * sidebar group named by the `##` heading above it.
 *
 * @param {string} markdown Index source.
 * @param {PageContext} ctx Where the index lives.
 * @returns {ConvertedIndex}
 */
export function convertIndex(markdown, ctx) {
  const tree = parser.parse(markdown);
  const title = takeTitle(tree, ctx.file);
  const tagline = leadParagraph(tree, ctx.file);
  tree.children.shift();

  /** @type {SidebarEntry[]} */
  const sidebar = [];
  /** @type {string[]} */
  const pages = [];
  /** @type {{ label: string, items: SidebarEntry[] } | undefined} */
  let group;
  tree.children = tree.children.map((node) => {
    if (node.type === "heading" && node.depth === 2) {
      group = { label: plainText(node), items: [] };
      sidebar.push(group);
      return node;
    }
    const links = node.type === "list" ? pageLinks(node, ctx) : undefined;
    if (!links) return node;
    for (const link of links) {
      pages.push(link.page);
      (group?.items ?? sidebar).push({
        label: link.title,
        link: pageRoute(ctx.slug, link.page),
      });
    }
    // LinkCard renders its title and description as HTML, so escape them,
    // and pass them as expressions: MDX would decode entities in a quoted
    // attribute.
    return jsx(
      "CardGrid",
      {},
      links.map((link) =>
        jsx("LinkCard", {
          title: { js: JSON.stringify(escapeHtml(link.title)) },
          href: pageRoute(ctx.slug, link.page),
          description: link.description
            ? { js: JSON.stringify(escapeHtml(link.description)) }
            : undefined,
        }),
      ),
    );
  });

  prepare(tree, ctx);
  return {
    title,
    tagline,
    body: serialize(tree),
    sidebar: sidebar.filter((entry) => !("items" in entry) || entry.items.length),
    pages,
  };
}

/**
 * Returns the route of a docs page.
 *
 * @param {string} slug Project slug.
 * @param {string} page Docs-relative page path, e.g. `guards.md`.
 */
export function pageRoute(slug, page) {
  const name = page.replace(/\.md$/, "");
  return name === "README" ? `/${slug}/` : `/${slug}/${name}/`;
}

/**
 * Removes the page's leading `#` heading and returns its text.
 *
 * @param {Root} tree
 * @param {string} file Page path, for errors.
 */
function takeTitle(tree, file) {
  const first = tree.children[0];
  if (first?.type !== "heading" || first.depth !== 1) {
    throw new DocsError(file, 'the page must start with a "# " heading');
  }
  tree.children.shift();
  return plainText(first);
}

/**
 * Returns the plain text of the paragraph that now opens the page, which
 * describes it. Search results, link previews and the index's hero show
 * this text, so a page without it is rejected.
 *
 * @param {Root} tree
 * @param {string} file Page path, for errors.
 */
function leadParagraph(tree, file) {
  const first = tree.children[0];
  const text = first?.type === "paragraph" ? plainText(first) : "";
  if (!text) {
    throw new DocsError(
      file,
      'the "# " heading must be followed by a paragraph that describes the page',
    );
  }
  return text;
}

/**
 * Returns the page links of a list whose every item is a link to a docs
 * page, optionally followed by a separator and a summary. Returns
 * `undefined` for any other list.
 *
 * @param {List} list
 * @param {PageContext} ctx
 */
function pageLinks(list, ctx) {
  const links = [];
  for (const item of list.children) {
    const [para, ...rest] = item.children;
    const [link, ...summary] = para?.type === "paragraph" ? para.children : [];
    if (rest.length || link?.type !== "link") return undefined;
    const page = docsPage(link.url, ctx);
    if (!page) return undefined;
    if (ctx.stat(path.join(ctx.docsDir, page)) !== "file") {
      throw new DocsError(ctx.file, `index lists missing page ${page}`);
    }
    links.push({
      page,
      title: plainText(link),
      description: plainText({ type: "paragraph", children: summary }).replace(
        LINK_SEPARATOR,
        "",
      ),
    });
  }
  return links.length ? links : undefined;
}

/**
 * Returns the docs-relative path of a link's target if it is a page in
 * the docs directory.
 *
 * @param {string} url
 * @param {PageContext} ctx
 */
function docsPage(url, ctx) {
  if (SCHEME.test(url) || url.startsWith("/") || url.startsWith("#")) {
    return undefined;
  }
  const target = resolveTarget(url.split("#")[0], ctx);
  const page = path.relative(ctx.docsDir, target);
  return !page.startsWith("..") && !page.includes("/") && PAGE_NAME.test(page)
    ? page
    : undefined;
}

/**
 * Applies every transform shared by pages and the index.
 *
 * @param {Root} tree
 * @param {PageContext} ctx
 */
function prepare(tree, ctx) {
  /** @type {References} */
  const refs = { images: new Set(), links: new Set() };
  collectReferences(tree, refs);
  rewriteUrls(tree, ctx, refs);
  transformBlocks(tree, ctx);
  const used = new Set();
  collectComponents(tree, used);
  if (used.size) {
    const names = [...used].sort().join(", ");
    tree.children.unshift(
      /** @type {Content} */ ({
        type: "mdxjsEsm",
        value: `import { ${names} } from "@astrojs/starlight/components";`,
      }),
    );
  }
}

/**
 * The definition identifiers that image and link references use.
 *
 * @typedef {{ images: Set<string>, links: Set<string> }} References
 */

/**
 * Adds the identifier of every image and link reference in the tree to
 * `refs`.
 *
 * @param {Node} node
 * @param {References} refs
 */
function collectReferences(node, refs) {
  if (node.type === "imageReference") refs.images.add(node.identifier);
  if (node.type === "linkReference") refs.links.add(node.identifier);
  if ("children" in node) {
    for (const child of node.children) collectReferences(child, refs);
  }
}

/**
 * Rewrites relative link and definition URLs, and rejects relative
 * images, inline or through a definition, which the site cannot serve.
 *
 * @param {Node} node
 * @param {PageContext} ctx
 * @param {References} refs Identifiers that references use.
 */
function rewriteUrls(node, ctx, refs) {
  const image =
    node.type === "image" || (node.type === "definition" && refs.images.has(node.identifier));
  // A definition can serve an image and a link at once.
  const link =
    node.type === "link" || (node.type === "definition" && (!image || refs.links.has(node.identifier)));
  if (image && isRelative(node.url)) {
    throw new DocsError(ctx.file, `relative image ${node.url} is not supported`);
  }
  if (node.type === "link" || node.type === "definition") {
    if (link) rejectUnportableLink(node.url, ctx);
    node.url = resolveUrl(node.url, ctx);
  }
  if ("children" in node) {
    for (const child of node.children) rewriteUrls(child, ctx, refs);
  }
}

/**
 * Rejects a link to a local server, which the site's link validator
 * refuses after conversion, and one that starts with `/`, which the site
 * reads from the site root and GitHub from the repository root. The
 * validator accepts the latter when it names a page on the site; the
 * standard forbids it anyway, since it is broken on GitHub.
 *
 * @param {string} url
 * @param {PageContext} ctx
 */
function rejectUnportableLink(url, ctx) {
  if (url.startsWith("/")) {
    throw new DocsError(
      ctx.file,
      `link ${url} starts with "/"; use a relative path to a file in the repository, or a full URL`,
    );
  }
  if (!SCHEME.test(url) || !URL.canParse(url)) return;
  const { hostname } = new URL(url);
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    throw new DocsError(
      ctx.file,
      `link ${url} points at a local server, which the site refuses; put it in backticks`,
    );
  }
}

/** @param {string} url */
function isRelative(url) {
  return !SCHEME.test(url) && !url.startsWith("/") && !url.startsWith("#");
}

/**
 * Resolves a link URL found in a page. Absolute URLs and fragments are
 * returned unchanged. Relative URLs that name a docs page become its
 * route; any other file or directory in the repository becomes a GitHub
 * link at the docs ref.
 *
 * @param {string} url
 * @param {PageContext} ctx
 */
export function resolveUrl(url, ctx) {
  if (!isRelative(url)) return url;
  const hashAt = url.indexOf("#");
  const target = resolveTarget(hashAt < 0 ? url : url.slice(0, hashAt), ctx);
  const hash = hashAt < 0 ? "" : url.slice(hashAt);
  const kind = ctx.stat(target);
  if (!kind) throw new DocsError(ctx.file, `link to missing ${target}`);

  const page = path.relative(ctx.docsDir, target);
  const inDocs = !page.startsWith("..") && !page.includes("/");
  if (kind === "file" && inDocs && page.endsWith(".md")) {
    if (page !== "README.md" && !PAGE_NAME.test(page)) {
      throw new DocsError(
        ctx.file,
        `docs page ${page} must be named in lowercase kebab-case`,
      );
    }
    return pageRoute(ctx.slug, page) + hash;
  }
  const mode = kind === "dir" ? "tree" : "blob";
  return `https://github.com/${ctx.repo}/${mode}/${ctx.ref}/${encodeURI(target)}${hash}`;
}

/**
 * Resolves a relative path against the page's directory, returning a
 * repository-relative path.
 *
 * @param {string} relative
 * @param {PageContext} ctx
 */
function resolveTarget(relative, ctx) {
  const from = path.dirname(path.join(ctx.docsDir, ctx.file));
  const target = path.normalize(path.join(from, decodeURI(relative)));
  if (target.startsWith("..")) {
    throw new DocsError(ctx.file, `link ${relative} leaves the repository`);
  }
  return target.replace(/\/$/, "") || ".";
}

/**
 * Replaces alerts, step lists and tree fences with components, and groups
 * tab fences, depth first.
 *
 * @param {Parent} parent
 * @param {PageContext} ctx
 */
function transformBlocks(parent, ctx) {
  for (const child of parent.children) {
    if ("children" in child) transformBlocks(child, ctx);
  }
  const replaced = parent.children
    .filter((node) => !isComment(node))
    .map((node) => {
      // GitHub strips tags it does not know, and MDX would read any tag as
      // JSX, so text such as `<name>` belongs in backticks.
      if (node.type === "html") {
        throw new DocsError(
          ctx.file,
          `raw HTML ${JSON.stringify(node.value.slice(0, 40))} is not supported; put it in backticks`,
        );
      }
      return replaceBlock(/** @type {Content} */ (node), ctx);
    });
  parent.children = /** @type {any} */ (groupTabs(replaced, ctx));
}

/** @param {Node} node */
function isComment(node) {
  return node.type === "html" && /^<!--[\s\S]*-->$/.test(node.value.trim());
}

/**
 * Returns the component that replaces a block, or the block unchanged.
 *
 * @param {Content} node
 * @param {PageContext} ctx
 * @returns {Content}
 */
function replaceBlock(node, ctx) {
  if (node.type === "blockquote") return alertToAside(node, ctx) ?? node;
  if (node.type === "list" && node.ordered && hasCodeItem(node)) {
    return jsx("Steps", {}, [node]);
  }
  if (node.type === "code" && node.lang === "tree") {
    return jsx("FileTree", {}, [parseTree(node.value, ctx)]);
  }
  return node;
}

/**
 * Converts a blockquote that opens with a GitHub alert marker on its own
 * line into an aside. Returns `undefined` for an ordinary blockquote.
 *
 * @param {import("mdast").Blockquote} node
 * @param {PageContext} ctx
 * @returns {Content | undefined}
 */
function alertToAside(node, ctx) {
  const para = node.children[0];
  const text = para?.type === "paragraph" ? para.children[0] : undefined;
  if (!para || text?.type !== "text") return undefined;
  const match = ALERT_MARKER.exec(text.value);
  if (!match) return undefined;
  const alert = ALERTS.get(match[1].toUpperCase());
  if (!alert) throw new DocsError(ctx.file, `unknown alert type [!${match[1]}]`);

  text.value = text.value.slice(match[0].length);
  if (!text.value) /** @type {Paragraph} */ (para).children.shift();
  if (!(/** @type {Paragraph} */ (para).children.length)) node.children.shift();
  return jsx("Aside", alert, node.children);
}

/** @param {List} list */
function hasCodeItem(list) {
  return list.children.some((item) =>
    item.children.some((child) => child.type === "code"),
  );
}

/**
 * Parses an indented path listing into the nested list `<FileTree>`
 * expects. Each line is a name, optionally followed by a comment;
 * deeper indentation nests under the line above.
 *
 * @param {string} value
 * @param {PageContext} ctx
 * @returns {List}
 */
function parseTree(value, ctx) {
  /** @type {List} */
  const root = { type: "list", ordered: false, spread: false, children: [] };
  /** @type {{ indent: number, item?: ListItem, list?: List }[]} */
  const stack = [{ indent: -1, list: root }];
  for (const line of value.split("\n")) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    while (indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (!parent.list) {
      if (!parent.item) throw new DocsError(ctx.file, "malformed tree");
      parent.list = { type: "list", ordered: false, spread: false, children: [] };
      parent.item.children.push(parent.list);
    }
    const [name, ...comment] = line.trim().split(/\s+/);
    /** @type {ListItem} */
    const item = {
      type: "listItem",
      spread: false,
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: [name, comment.join(" ")].join(" ").trim() }],
        },
      ],
    };
    parent.list.children.push(item);
    stack.push({ indent, item });
  }
  return root;
}

/**
 * Groups runs of adjacent tab fences, each optionally preceded by a
 * lead-in paragraph ending in a colon, into `<Tabs>`.
 *
 * @param {Content[]} nodes
 * @param {PageContext} ctx
 * @returns {Content[]}
 */
function groupTabs(nodes, ctx) {
  /** @type {Content[]} */
  const out = [];
  let i = 0;
  while (i < nodes.length) {
    /** @type {{ label: string, nodes: Content[] }[]} */
    const items = [];
    let next = i;
    for (;;) {
      const lead = isLeadIn(nodes[next]) && tabLabel(nodes[next + 1]) !== undefined;
      const fence = nodes[next + (lead ? 1 : 0)];
      const label = tabLabel(fence);
      if (label === undefined) break;
      const code = /** @type {Code} */ (fence);
      code.meta = code.meta?.replace(TAB_META, " ").trim() || null;
      items.push({ label, nodes: lead ? [nodes[next], code] : [code] });
      next += lead ? 2 : 1;
    }
    if (!items.length) {
      out.push(nodes[i++]);
      continue;
    }
    const labels = items.map((item) => item.label);
    if (items.length < 2) {
      throw new DocsError(ctx.file, `tab "${labels[0]}" needs an adjacent tab fence`);
    }
    if (new Set(labels).size !== labels.length) {
      throw new DocsError(ctx.file, `duplicate tab labels ${labels.join(", ")}`);
    }
    // Tab groups offering the same choices share a key, so the reader's
    // pick carries across them.
    const syncKey = `${ctx.slug}:${[...labels].sort().join("|")}`;
    out.push(
      jsx(
        "Tabs",
        { syncKey },
        items.map((item) => jsx("TabItem", { label: item.label }, item.nodes)),
      ),
    );
    i = next;
  }
  return out;
}

/**
 * Returns the `tab="…"` label of a code fence, if it has one.
 *
 * @param {Content | undefined} node
 */
function tabLabel(node) {
  return node?.type === "code" && node.meta
    ? TAB_META.exec(node.meta)?.[1]
    : undefined;
}

/** @param {Content | undefined} node */
function isLeadIn(node) {
  return node?.type === "paragraph" && /:\s*$/.test(toString(node));
}

/**
 * Adds the name of every component used in the tree to `used`.
 *
 * @param {Node} node
 * @param {Set<string>} used
 */
function collectComponents(node, used) {
  if (node.type === "mdxJsxFlowElement" && node.name) used.add(node.name);
  if ("children" in node) {
    for (const child of node.children) collectComponents(child, used);
  }
}

/**
 * Builds an MDX JSX block element. A string attribute is written quoted;
 * `{ js }` is written as the expression `{js}`. Attributes whose value is
 * `undefined` are left out.
 *
 * @param {string} name
 * @param {Record<string, string | { js: string } | undefined>} attributes
 * @param {any[]} [children]
 * @returns {Content}
 */
function jsx(name, attributes, children = []) {
  return /** @type {Content} */ ({
    type: "mdxJsxFlowElement",
    name,
    attributes: Object.entries(attributes)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        type: "mdxJsxAttribute",
        name: key,
        value:
          typeof value === "string"
            ? value
            : { type: "mdxJsxAttributeValueExpression", value: value?.js },
      })),
    children,
  });
}

/**
 * Escapes text for a context that renders it as HTML, such as Starlight's
 * hero and link cards.
 *
 * @param {string} text
 */
export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Returns a node's text with runs of whitespace collapsed.
 *
 * @param {Node} node
 */
function plainText(node) {
  return toString(node).replace(/\s+/g, " ").trim();
}

/**
 * Serializes the tree as MDX, escaping characters such as `<` and `{`
 * that are plain text in Markdown but syntax in MDX.
 *
 * @param {Root} tree
 */
function serialize(tree) {
  return serializer.stringify(tree);
}

/**
 * Renders front matter. Values are written as JSON, which YAML reads
 * as-is; dates are written as bare ISO timestamps so YAML parses them as
 * dates.
 *
 * @param {Record<string, unknown>} fields
 */
export function frontmatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${key}: ${value instanceof Date ? value.toISOString() : JSON.stringify(value)}`,
    );
  return ["---", ...lines, "---", ""].join("\n");
}
