import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Serve Arena's complete document without the site's shared header, footer,
// fonts or stylesheet changing its approved design.
export async function GET() {
  const html = await readFile(join(process.cwd(), "src/content/readiness.html"), "utf8");
  const scriptHashes = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`)
    .join(" ");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": `default-src 'none'; script-src ${scriptHashes}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}
