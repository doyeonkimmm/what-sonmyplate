import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  const { id } = await context.params;
  const bindings = env as unknown as { DB: D1Database; PHOTOS: R2Bucket };
  const row = await bindings.DB.prepare(
    "SELECT owner_email, visibility, image_key FROM records WHERE id = ?",
  ).bind(id).first<{ owner_email: string; visibility: string; image_key: string | null }>();

  if (!row?.image_key) return new Response("Not found", { status: 404 });
  if (row.visibility === "private" && user?.email !== row.owner_email) {
    return new Response("Forbidden", { status: 403 });
  }

  const object = await bindings.PHOTOS.get(row.image_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", row.visibility === "private" ? "private, max-age=300" : "public, max-age=3600");
  return new Response(object.body, { headers });
}
