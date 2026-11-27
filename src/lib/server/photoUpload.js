import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./auth.js";
import { processListingImage } from "./images.js";

const MAX_PHOTOS = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_PHOTOS * MAX_FILE_BYTES + 1024 * 1024;
const LIMIT = 5;
const WINDOW_MS = 60_000;

const attempts = (globalThis.marketplacePhotoAttempts ??= new Map());
const active = (globalThis.marketplacePhotoUploads ??= new Set());

function checkRateLimit(userId) {
  const now = Date.now();

  for (const [id, times] of attempts) {
    if (now - times[times.length - 1] >= WINDOW_MS) {
      attempts.delete(id);
    }
  }

  const times = (attempts.get(userId) ?? []).filter(
    (time) => now - time < WINDOW_MS,
  );

  if (times.length >= LIMIT || active.has(userId)) {
    throw new HttpError(
      429,
      "Too many photo uploads. Please try again shortly.",
    );
  }

  attempts.set(userId, [...times, now]);
}

export function imageExtension(bytes) {
  if (
    bytes.length >= 3 &&
    bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  ) {
    return "jpg";
  }

  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }

  const gif = bytes.toString("latin1", 0, 6);

  if (bytes.length >= 6 && (gif === "GIF87a" || gif === "GIF89a")) {
    return "gif";
  }

  if (
    bytes.length >= 12 &&
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

async function readPhotos(request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) {
    throw new HttpError(400, "Send photos as multipart/form-data.");
  }

  const tooLarge = () =>
    new HttpError(
      413,
      "Upload is too large. Send at most 8 photos of 10 MB each.",
    );

  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw tooLarge();
  }

  let total = 0;

  const limited = request.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        total += chunk.byteLength;

        if (total > MAX_BODY_BYTES) {
          throw tooLarge();
        }

        controller.enqueue(chunk);
      },
    }),
  );

  let form;

  try {
    form = await new Response(limited, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    if (total > MAX_BODY_BYTES) throw tooLarge();
    throw new HttpError(400, "Invalid photo upload.");
  }

  const files = form.getAll("photos");

  if (
    [...form.keys()].some((key) => key !== "photos") ||
    files.length === 0 ||
    files.some((file) => !(file instanceof File))
  ) {
    throw new HttpError(400, "Send one or more files in the photos field.");
  }

  if (files.length > MAX_PHOTOS) {
    throw new HttpError(400, "At most 8 photos are allowed.");
  }

  const validated = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      throw new HttpError(413, "Each photo must be 10 MB or smaller.");
    }

    const extension = imageExtension(
      Buffer.from(await file.slice(0, 12).arrayBuffer()),
    );

    if (!extension) {
      throw new HttpError(400, "Photos must be JPEG, PNG, GIF or WebP images.");
    }

    validated.push({ file, extension });
  }

  return validated;
}

export async function uploadListingPhotos(request, user) {
  const userId = user._id.toString();

  checkRateLimit(userId);
  active.add(userId);

  const storage = path.join(process.cwd(), "storage");
  const completed = [];

  try {
    const files = await readPhotos(request);
    await mkdir(storage, { recursive: true });

    for (const { file, extension } of files) {
      const filename = `${randomUUID()}.${extension}`;
      const original = path.join(storage, filename);

      try {
        await writeFile(original, Buffer.from(await file.arrayBuffer()), {
          flag: "wx",
        });

        let photo;

        try {
          photo = await processListingImage(filename);
        } catch (error) {
          console.error(error);
          throw new HttpError(
            422,
            "Could not process photo. Check the image and try again.",
          );
        }

        completed.push(photo);
      } finally {
        await rm(original, { force: true });
      }
    }

    return completed.map((photo) =>
      Object.fromEntries(
        Object.entries(photo).map(([size, filename]) => [size, `/${filename}`]),
      ),
    );
  } catch (error) {
    for (const photo of completed) {
      for (const filename of Object.values(photo)) {
        await rm(path.join(storage, filename), { force: true });
      }
    }

    throw error;
  } finally {
    active.delete(userId);
  }
}
