import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { runMagick } from "./imagemagick.js";

const SIZES = {
  thumb: 200,
  card: 800,
  full: 1600,
};

export async function processListingImage(filename) {
  if (
    typeof filename !== "string" ||
    !/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
  ) {
    throw new Error("Invalid image filename.");
  }

  const id = randomUUID();
  const outputDir = path.join(process.cwd(), "storage", "images");
  const files = {};

  await mkdir(outputDir, { recursive: true });

  try {
    for (const [type, size] of Object.entries(SIZES)) {
      const output = `images/${id}-${type}.webp`;
      files[type] = output;

      await runMagick([
        `./${filename}[0]`,
        "-auto-orient",
        "-strip",
        "-resize",
        `${size}x${size}>`,
        "-quality",
        "85",
        output,
      ]);
    }

    return files;
  } catch (error) {
    for (const file of Object.values(files)) {
      await rm(path.join(process.cwd(), "storage", file), {
        force: true,
      });
    }

    throw error;
  }
}
