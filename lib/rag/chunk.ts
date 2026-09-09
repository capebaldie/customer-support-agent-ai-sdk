export type Chunk = {
  docSlug: string;
  docTitle: string;
  url: string;
  category: string;
  // frontmatter `updated`, carried through so citations can show doc age
  updated: string;
  // the breadcrumb of headings above this section, joined with ` > `, e.g. `## 409 — Conflict` and `### schema_locked` become `409 — Conflict > schema_locked`
  headingPath: string;
  // the prose of this section, which may be multiple paragraphs and include code blocks, lists, etc.
  content: string;
  // the text to embed for semantic search. This is the heading breadcrumb followed by the section content, separated by two newlines.
  embeddingInput: string;
};

// The frontmatter is a YAML block at the top of the markdown file that contains metadata about the document. It is delimited by `---` lines. The body is the rest of the markdown content after the frontmatter.
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

// values contain colons (`url: https://...`), so split on the first one only
function parseFrontmatter(source: string) {
  // exec returns null if no match, or an array of matches if it does. The first element is the whole match, the second is the first capture group.
  const match = FRONTMATTER.exec(source);
  if (!match) throw new Error("document has no frontmatter");

  // parse the frontmatter into a key-value map. The frontmatter is a YAML block, but we don't need a full YAML parser for this simple case.
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { meta, body: source.slice(match[0].length) };
}

type Section = { headingPath: string; lines: string[] };

// Splits on ## and ### into flat sections, each carrying the breadcrumb of the
// headings above it. A ``` fence suspends heading detection so that markdown
// examples inside code blocks are not mistaken for structure.
function splitSections(body: string): Section[] {
  const sections: Section[] = [{ headingPath: "", lines: [] }];
  const stack: { level: number; title: string }[] = [];
  let inFence = false;

  for (const line of body.split("\n")) {
    if (line.startsWith("```")) inFence = !inFence;

    const heading = inFence ? null : /^(#{2,3}) +(.*)$/.exec(line);
    if (!heading) {
      // the H1 repeats the frontmatter title, which the breadcrumb already carries
      if (!line.startsWith("# ")) sections.at(-1)!.lines.push(line);
      continue;
    }

    const level = heading[1].length;
    const title = heading[2].trim().replace(/`/g, "");
    while (stack.length && stack.at(-1)!.level >= level) stack.pop();
    stack.push({ level, title });

    sections.push({
      headingPath: stack.map((h) => h.title).join(" > "),
      lines: [],
    });
  }

  return sections;
}

/**
 * One chunk per heading section of a support doc.
 *
 * Sections with no prose of their own are dropped — `## 409 — Conflict` is a
 * divider, not an answer. Their titles survive in the breadcrumbs of the
 * sections beneath them, which is what puts `409` in front of the two
 * sentences under `### schema_locked` that never mention the status code.
 *
 * Sections are not split further and small ones are not merged: the largest
 * here is ~470 tokens, and a 26-token section that answers one question
 * precisely retrieves better alone than blurred into its neighbour.
 */
export function chunkMarkdown(source: string): Chunk[] {
  const { meta, body } = parseFrontmatter(source);

  return splitSections(body).flatMap(({ headingPath, lines }) => {
    const content = lines.join("\n").trim();
    if (!content) return [];

    const breadcrumb = [meta.title, headingPath].filter(Boolean).join(" > ");

    return [
      {
        docSlug: meta.slug,
        docTitle: meta.title,
        url: meta.url,
        category: meta.category,
        updated: meta.updated,
        headingPath,
        content,
        embeddingInput: `${breadcrumb}\n\n${content}`,
      },
    ];
  });
}
