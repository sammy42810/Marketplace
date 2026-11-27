import { withUser } from "@/lib/server/auth";
import { uploadListingPhotos } from "@/lib/server/photoUpload";

export const runtime = "nodejs";

export const POST = withUser(async (request, context, user) => {
  const photos = await uploadListingPhotos(request, user);
  return Response.json({ photos }, { status: 201 });
});
