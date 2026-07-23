import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { hashPassword, makeSession, readSession, sessionCookie } from "../../auth";

const DB = () => (env as unknown as { DB: D1Database }).DB;
const cleanUsername = (v: unknown) => String(v || "").trim().toLowerCase();

async function ensureAuthSchema() {
  await DB().prepare(`CREATE TABLE IF NOT EXISTS accounts (
    id text PRIMARY KEY NOT NULL,
    username text NOT NULL UNIQUE,
    email text NOT NULL,
    nickname text NOT NULL,
    password_hash text NOT NULL,
    password_salt text NOT NULL,
    created_at integer NOT NULL
  )`).run();
  await DB().prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
    key text PRIMARY KEY NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    blocked_until integer DEFAULT 0 NOT NULL,
    updated_at integer NOT NULL
  )`).run();
}

export async function GET(request: Request) {
  await ensureAuthSchema();
  const url = new URL(request.url);
  if (url.searchParams.get("me") === "1") {
    const requestHeaders = await headers();
    const session = await readSession(requestHeaders.get("cookie"));
    if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    return Response.json({
      username: session.username,
      email: session.email,
      displayName: session.displayName,
    });
  }
  const username = cleanUsername(url.searchParams.get("username"));
  if (!/^[a-z0-9._-]{1,20}$/.test(username)) return Response.json({ available: false });
  const row = await DB().prepare("SELECT 1 FROM accounts WHERE username = ?").bind(username).first();
  return Response.json({ available: !row });
}

async function handlePost(request: Request) {
  await ensureAuthSchema();
  const body = await request.json<Record<string, string | boolean>>();
  const action = body.action;
  const username = cleanUsername(body.username);
  const remember = body.remember === true;
  if (action === "logout") {
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": "plate_session_v3=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" } },
    );
  }
  if (action === "signup") {
    const email = String(body.email || "").trim().toLowerCase();
    const nickname = String(body.nickname || "").trim().slice(0, 20);
    const password = String(body.password || "");
    if (!/^[a-z0-9._-]{1,20}$/.test(username)) return Response.json({ error: "아이디는 영문 소문자·숫자 1~20자로 입력해 주세요." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "복구용 이메일을 확인해 주세요." }, { status: 400 });
    if (!password) return Response.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
    if (!nickname) return Response.json({ error: "닉네임을 입력해 주세요." }, { status: 400 });
    const exists = await DB().prepare("SELECT 1 FROM accounts WHERE username = ?").bind(username).first();
    if (exists) return Response.json({ error: "이미 사용 중인 아이디예요." }, { status: 409 });
    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    await DB().prepare("INSERT INTO accounts (id, username, email, nickname, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, username, email, nickname, hash, salt, Date.now()).run();
    const token = await makeSession({ id, username, email, displayName: nickname, remember });
    return Response.json(
      { ok: true },
      { status: 201, headers: { "Set-Cookie": sessionCookie(token, remember ? 2592000 : undefined) } },
    );
  }

  if (action === "login") {
    const key = `login:${username}`;
    const attempt = await DB().prepare("SELECT attempts, blocked_until FROM login_attempts WHERE key = ?").bind(key).first<{ attempts: number; blocked_until: number }>();
    if (attempt && attempt.blocked_until > Date.now()) return Response.json({ error: "로그인 시도가 많아요. 15분 뒤 다시 시도해 주세요." }, { status: 429 });
    const account = await DB().prepare("SELECT id, username, email, nickname, password_hash, password_salt FROM accounts WHERE username = ?").bind(username).first<any>();
    const computed = account ? await hashPassword(String(body.password || ""), account.password_salt) : null;
    if (!account || computed?.hash !== account.password_hash) {
      const count = (attempt?.attempts || 0) + 1;
      await DB().prepare("INSERT INTO login_attempts (key, attempts, blocked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET attempts=?, blocked_until=?, updated_at=?")
        .bind(key, count, count >= 5 ? Date.now() + 900000 : 0, Date.now(), count, count >= 5 ? Date.now() + 900000 : 0, Date.now()).run();
      return Response.json({ error: "아이디 또는 비밀번호가 맞지 않아요." }, { status: 401 });
    }
    await DB().prepare("DELETE FROM login_attempts WHERE key = ?").bind(key).run();
    const token = await makeSession({ id: account.id, username, email: account.email, displayName: account.nickname, remember });
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": sessionCookie(token, remember ? 2592000 : undefined) } },
    );
  }

  if (action === "recover") {
    const email = String(body.email || "").trim().toLowerCase();
    await DB().prepare("SELECT 1 FROM accounts WHERE username = ? AND email = ?").bind(username, email).first();
    return Response.json({ message: "일치하는 계정이 있으면 복구 안내를 보내드릴게요." });
  }
  return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    console.error("AUTH_SAVE_FAILED", error);
    return Response.json({ error: "가입 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요. (AUTH_SAVE_FAILED)" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureAuthSchema();
    const requestHeaders = await headers();
    const session = await readSession(requestHeaders.get("cookie"));
    if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await request.json<{ nickname?: string }>();
    const nickname = String(body.nickname || "").trim();
    if (nickname.length < 2 || nickname.length > 12) {
      return Response.json({ error: "닉네임은 2~12자로 입력해 주세요." }, { status: 400 });
    }

    await DB().prepare("UPDATE accounts SET nickname = ? WHERE id = ?").bind(nickname, session.id).run();
    const token = await makeSession({ ...session, displayName: nickname });
    return Response.json(
      { ok: true, displayName: nickname },
      { headers: { "Set-Cookie": sessionCookie(token, session.remember ? 2592000 : undefined) } },
    );
  } catch (error) {
    console.error("NICKNAME_UPDATE_FAILED", error);
    return Response.json({ error: "닉네임을 변경하지 못했어요." }, { status: 500 });
  }
}
