import { readFileSync, readdirSync } from "node:fs";
import Link from "next/link";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { parseFrontmatter } from "@/lib/rag/chunk";

const DOCS = "content/docs";

// Every citation in an answer lands here, so the pages are prerendered from the same files ingest
// reads: nothing touches the filesystem at request time, and a slug that is not a doc 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return readdirSync(DOCS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ slug: f.slice(0, -".md".length) }));
}

export default async function DocPage({ params }: PageProps<"/docs/[slug]">) {
  const { slug } = await params;
  const { meta, body } = parseFrontmatter(
    readFileSync(`${DOCS}/${slug}.md`, "utf8"),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <Link href="/" className="text-sm text-depth">
        ← Support
      </Link>

      {/* the H1 repeats the frontmatter title, and `.answer h1` is sized for a heading inside an
          answer, not for the top of a page — so the title is set here and dropped from the body */}
      <h1 className="mt-8 text-2xl font-bold tracking-tight">{meta.title}</h1>
      <article className="answer mt-6">
        <Streamdown>{body.replace(/^# .+\r?\n/, "")}</Streamdown>
      </article>

      <p className="mt-12 text-sm text-depth">Last updated {meta.updated}</p>
    </main>
  );
}
