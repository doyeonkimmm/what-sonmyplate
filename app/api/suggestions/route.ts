import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const DB = () => (env as unknown as { DB: D1Database }).DB;

async function ensureSuggestionsSchema() {
  await DB().prepare(`CREATE TABLE IF NOT EXISTS suggestions (
    id text PRIMARY KEY NOT NULL,
    owner_email text NOT NULL,
    owner_username text NOT NULL,
    owner_nickname text NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    created_at integer NOT NULL
  )`).run();
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  await ensureSuggestionsSchema();
  const body = await request.json<{ content?: string }>();
  const content = String(body.content || "").trim();
  if (content.length < 2) return Response.json({ error: "건의 내용을 조금 더 적어 주세요." }, { status: 400 });
  if (content.length > 500) return Response.json({ error: "건의 내용은 500자 이하로 적어 주세요." }, { status: 400 });

  const id = crypto.randomUUID();
  await DB().prepare(
    "INSERT INTO suggestions (id, owner_email, owner_username, owner_nickname, content, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
  ).bind(id, user.email, user.username, user.displayName, content, Date.now()).run();
  return Response.json({ ok: true, id }, { status: 201 });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.username !== "doyeon") return Response.json({ error: "관리자만 확인할 수 있어요." }, { status: 403 });
  await ensureSuggestionsSchema();
  const result = await DB().prepare(
    "SELECT id, owner_username, owner_nickname, content, status, created_at FROM suggestions ORDER BY created_at DESC",
  ).all<{
    id: string;
    owner_username: string;
    owner_nickname: string;
    content: string;
    status: "pending" | "done";
    created_at: number;
  }>();
  return Response.json(result.results.map((item) => ({
    id: item.id,
    username: item.owner_username,
    nickname: item.owner_nickname,
    content: item.content,
    status: item.status,
    createdAt: item.created_at,
  })));
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.username !== "doyeon") return Response.json({ error: "관리자만 처리할 수 있어요." }, { status: 403 });
  await ensureSuggestionsSchema();
  const body = await request.json<{ id?: string; status?: "pending" | "done" }>();
  if (!body.id || !["pending", "done"].includes(String(body.status))) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await DB().prepare("UPDATE suggestions SET status = ? WHERE id = ?").bind(body.status, body.id).run();
  return Response.json({ ok: true });
}
