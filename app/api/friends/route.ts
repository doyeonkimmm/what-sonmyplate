import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const palette = ["#efc3c2", "#b9dedc", "#e1dba6", "#d5cde2"];
const view = (row: { id: string; friend_email: string; nickname?: string | null; username?: string | null }, index = 0) => ({
  id: row.id,
  email: row.username ? `@${row.username}` : row.friend_email,
  name: row.nickname || row.username || row.friend_email.split("@")[0],
  color: palette[index % palette.length],
});

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json([]);
  const DB = (env as unknown as { DB: D1Database }).DB;
  const result = await DB.prepare(
    `SELECT f.id, f.friend_email, a.nickname, a.username
     FROM friendships f LEFT JOIN accounts a ON a.email = f.friend_email
     WHERE f.owner_email = ? ORDER BY f.created_at`,
  ).bind(user.email).all<{ id: string; friend_email: string; nickname: string | null; username: string | null }>();
  return Response.json(result.results.map(view));
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { username } = await request.json<{ username?: string }>();
  const friendUsername = String(username || "").trim().toLowerCase();
  if (!friendUsername) return Response.json({ error: "친구 아이디를 입력해 주세요." }, { status: 400 });
  const id = crypto.randomUUID();
  const DB = (env as unknown as { DB: D1Database }).DB;
  const friend = await DB.prepare("SELECT email, nickname, username FROM accounts WHERE username = ?").bind(friendUsername).first<{ email: string; nickname: string; username: string }>();
  if (!friend) return Response.json({ error: "해당 아이디를 찾을 수 없어요." }, { status: 404 });
  if (friend.email === user.email) return Response.json({ error: "내 아이디는 추가할 수 없어요." }, { status: 400 });
  const friendEmail = friend.email;
  const exists = await DB.prepare("SELECT id FROM friendships WHERE owner_email = ? AND friend_email = ?").bind(user.email, friendEmail).first();
  if (exists) return Response.json({ error: "이미 추가한 친구예요." }, { status: 409 });
  await DB.prepare(
    "INSERT INTO friendships (id, owner_email, friend_email, created_at) VALUES (?, ?, ?, ?)",
  ).bind(id, user.email, friendEmail, Date.now()).run();
  return Response.json(view({ id, friend_email: friendEmail, nickname: friend.nickname, username: friend.username }), { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const DB = (env as unknown as { DB: D1Database }).DB;
  await DB.prepare("DELETE FROM friendships WHERE id = ? AND owner_email = ?").bind(id, user.email).run();
  return new Response(null, { status: 204 });
}
