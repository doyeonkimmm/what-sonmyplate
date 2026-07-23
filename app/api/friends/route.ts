import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const palette = ["#efc3c2", "#b9dedc", "#e1dba6", "#d5cde2"];
const view = (row: { id: string; friend_email: string; nickname?: string | null; username?: string | null; favorite?: number | null }, index = 0) => ({
  id: row.id,
  email: row.username ? `@${row.username}` : row.friend_email,
  name: row.nickname || row.username || row.friend_email.split("@")[0],
  color: palette[index % palette.length],
  favorite: Boolean(row.favorite),
});

async function ensureFriendSchema(DB: D1Database) {
  const columns = await DB.prepare("PRAGMA table_info(friendships)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "status")) {
    try {
      await DB.prepare("ALTER TABLE friendships ADD status text DEFAULT 'accepted' NOT NULL").run();
    } catch (error) {
      if (!/duplicate column|already exists/i.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
  if (!columns.results.some((column) => column.name === "favorite")) {
    try {
      await DB.prepare("ALTER TABLE friendships ADD favorite integer DEFAULT 0 NOT NULL").run();
    } catch (error) {
      if (!/duplicate column|already exists/i.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json([]);
  const DB = (env as unknown as { DB: D1Database }).DB;
  await ensureFriendSchema(DB);
  const requestsOnly = new URL(request.url).searchParams.get("requests") === "1";
  if (requestsOnly) {
    const requests = await DB.prepare(
      `SELECT f.id, f.owner_email AS friend_email, a.nickname, a.username, 0 AS favorite
       FROM friendships f LEFT JOIN accounts a ON a.email = f.owner_email
       WHERE f.friend_email = ? AND f.status = 'pending' ORDER BY f.created_at`,
    ).bind(user.email).all<{ id: string; friend_email: string; nickname: string | null; username: string | null }>();
    return Response.json(requests.results.map(view));
  }
  const result = await DB.prepare(
    `SELECT f.id, f.friend_email, a.nickname, a.username, f.favorite
     FROM friendships f LEFT JOIN accounts a ON a.email = f.friend_email
     WHERE f.owner_email = ? AND f.status = 'accepted' ORDER BY f.favorite DESC, f.created_at`,
  ).bind(user.email).all<{ id: string; friend_email: string; nickname: string | null; username: string | null; favorite: number }>();
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
  await ensureFriendSchema(DB);
  const friend = await DB.prepare("SELECT email, nickname, username FROM accounts WHERE username = ?").bind(friendUsername).first<{ email: string; nickname: string; username: string }>();
  if (!friend) return Response.json({ error: "해당 아이디를 찾을 수 없어요." }, { status: 404 });
  if (friend.email === user.email) return Response.json({ error: "내 아이디는 추가할 수 없어요." }, { status: 400 });
  const friendEmail = friend.email;
  const exists = await DB.prepare("SELECT status FROM friendships WHERE owner_email = ? AND friend_email = ?").bind(user.email, friendEmail).first<{ status: string }>();
  if (exists?.status === "accepted") return Response.json({ error: "이미 친구예요." }, { status: 409 });
  if (exists?.status === "pending") return Response.json({ error: "이미 친구 요청을 보냈어요." }, { status: 409 });
  await DB.prepare(
    "INSERT INTO friendships (id, owner_email, friend_email, created_at, status) VALUES (?, ?, ?, ?, 'pending')",
  ).bind(id, user.email, friendEmail, Date.now()).run();
  return Response.json({ pending: true, name: friend.nickname || friend.username }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id, action, favorite } = await request.json<{ id?: string; action?: "accept" | "reject" | "favorite"; favorite?: boolean }>();
  const DB = (env as unknown as { DB: D1Database }).DB;
  await ensureFriendSchema(DB);

  if (action === "favorite") {
    const friendship = await DB.prepare(
      "SELECT id, favorite FROM friendships WHERE id = ? AND owner_email = ? AND status = 'accepted'",
    ).bind(id, user.email).first<{ id: string; favorite: number }>();
    if (!friendship) return Response.json({ error: "친구를 찾을 수 없어요." }, { status: 404 });
    const nextFavorite = favorite ? 1 : 0;
    if (nextFavorite) {
      const count = await DB.prepare(
        "SELECT COUNT(*) AS count FROM friendships WHERE owner_email = ? AND status = 'accepted' AND favorite = 1",
      ).bind(user.email).first<{ count: number }>();
      if ((count?.count || 0) >= 2 && !friendship.favorite) {
        return Response.json({ error: "즐겨찾기는 최대 2명까지 가능해요." }, { status: 409 });
      }
    }
    await DB.prepare("UPDATE friendships SET favorite = ? WHERE id = ? AND owner_email = ?")
      .bind(nextFavorite, id, user.email).run();
    return Response.json({ id, favorite: Boolean(nextFavorite) });
  }

  const pending = await DB.prepare(
    "SELECT id, owner_email FROM friendships WHERE id = ? AND friend_email = ? AND status = 'pending'",
  ).bind(id, user.email).first<{ id: string; owner_email: string }>();
  if (!pending) return Response.json({ error: "처리할 친구 요청이 없어요." }, { status: 404 });
  if (action === "reject") {
    await DB.prepare("DELETE FROM friendships WHERE id = ?").bind(pending.id).run();
    return new Response(null, { status: 204 });
  }
  if (action !== "accept") return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  await DB.batch([
    DB.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").bind(pending.id),
    DB.prepare("UPDATE friendships SET status = 'accepted' WHERE owner_email = ? AND friend_email = ?")
      .bind(user.email, pending.owner_email),
    DB.prepare(
      `INSERT INTO friendships (id, owner_email, friend_email, created_at, status)
       SELECT ?, ?, ?, ?, 'accepted'
       WHERE NOT EXISTS (SELECT 1 FROM friendships WHERE owner_email = ? AND friend_email = ?)`,
    ).bind(crypto.randomUUID(), user.email, pending.owner_email, Date.now(), user.email, pending.owner_email),
  ]);
  const reciprocal = await DB.prepare(
    "SELECT id FROM friendships WHERE owner_email = ? AND friend_email = ? AND status = 'accepted' ORDER BY created_at LIMIT 1",
  ).bind(user.email, pending.owner_email).first<{ id: string }>();
  const account = await DB.prepare("SELECT nickname, username FROM accounts WHERE email = ?").bind(pending.owner_email).first<{ nickname: string; username: string }>();
  return Response.json(view({ id: reciprocal?.id || pending.id, friend_email: pending.owner_email, nickname: account?.nickname, username: account?.username, favorite: 0 }));
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const DB = (env as unknown as { DB: D1Database }).DB;
  await ensureFriendSchema(DB);
  const friendship = await DB.prepare("SELECT friend_email FROM friendships WHERE id = ? AND owner_email = ?").bind(id, user.email).first<{ friend_email: string }>();
  if (friendship) {
    await DB.prepare(
      "DELETE FROM friendships WHERE (owner_email = ? AND friend_email = ?) OR (owner_email = ? AND friend_email = ?)",
    ).bind(user.email, friendship.friend_email, friendship.friend_email, user.email).run();
  }
  return new Response(null, { status: 204 });
}
