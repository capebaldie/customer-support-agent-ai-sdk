import { readFileSync, readdirSync } from "node:fs";
import Link from "next/link";
import { parseFrontmatter } from "@/lib/rag/chunk";

const DOCS = "content/docs";

// support-and-sla.md links here as the documentation home, so /docs is a page rather than a 404.
const index = readdirSync(DOCS)
  .filter((f) => f.endsWith(".md"))
  .map((f) => parseFrontmatter(readFileSync(`${DOCS}/${f}`, "utf8")).meta)
  .sort((a, b) => a.title.localeCompare(b.title));

export default function DocsIndex() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <Link href="/" className="text-sm text-depth">
        ← Support
      </Link>

      <h1 className="mt-8 text-2xl font-bold tracking-tight">Documentation</h1>
      <ul className="mt-6 space-y-3">
        {index.map((doc) => (
          <li key={doc.slug}>
            <Link href={doc.url} className="text-signal underline underline-offset-2">
              {doc.title}
            </Link>
            <span className="ml-2 text-sm text-depth">{doc.category}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
