import { open } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export async function serveUploads(req, res) {
  const pathname = req.url.split("?")[0];

  const match =
    /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(?:thumb|card|full)\.webp)$/.exec(
      pathname,
    );

  if (!match) {
    res.writeHead(404).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let file;

  try {
    file = await open(
      path.join(process.cwd(), "storage", "uploads", match[1]),
      "r",
    );

    const stat = await file.stat();

    if (!stat.isFile()) {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": "image/webp",
      "Content-Length": stat.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    });

    if (req.method === "HEAD") {
      res.end();
    } else {
      await pipeline(file.createReadStream({ autoClose: false }), res);
    }
  } catch (error) {
    if (!res.headersSent && !res.destroyed) {
      res
        .writeHead(
          error.code === "ENOENT" || error.code === "ENOTDIR" ? 404 : 500,
        )
        .end();
    } else if (!res.destroyed) {
      res.destroy();
    }
  } finally {
    if (file) await file.close();
  }
}
