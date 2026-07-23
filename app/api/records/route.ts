import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type RecordRow = {
  id: string;
  record_date: string;
  record_time: string;
  location: string;
  show_location: number;
  visibility: "private" | "friends";
  food: string;
  meal_type: "delivery" | "dining" | "home";
  expense: number;
  memo: string;
  image_key: string | null;
};

function bindings() {
  return env as unknown as {
    DB: D1Database;
    PHOTOS: R2Bucket;
  };
}

function toClient(row: RecordRow) {
  const [year, month, day] = row.record_date.split("-").map(Number);
  return {
    id: row.id,
    year,
    month,
    day,
    time: row.record_time,
    location: row.location,
    showLocation: Boolean(row.show_location),
    visibility: row.visibility,
    food: row.food,
    mealType: row.meal_type,
    expense: row.expense,
    memo: row.memo,
    photoUrl: row.image_key ? `/api/photos/${row.id}` : undefined,
  };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json([]);
  const { DB } = bindings();
  const friendId = new URL(request.url).searchParams.get("friendId");
  if (friendId) {
    const friendship = await DB.prepare(
      "SELECT friend_email FROM friendships WHERE id = ? AND owner_email = ?",
    ).bind(friendId, user.email).first<{ friend_email: string }>();
    if (!friendship) return Response.json({ error: "친구 관계를 확인할 수 없어요." }, { status: 403 });
    const shared = await DB.prepare(
      `SELECT id, record_date, record_time, location, show_location, visibility, food, meal_type, expense, memo, image_key
       FROM records WHERE owner_email = ? AND visibility = 'friends' ORDER BY record_date DESC, record_time DESC`,
    ).bind(friendship.friend_email).all<RecordRow>();
    return Response.json(shared.results.map(toClient));
  }
  const result = await DB.prepare(
    `SELECT id, record_date, record_time, location, show_location, visibility, food, meal_type, expense, memo, image_key
     FROM records WHERE owner_email = ? ORDER BY record_date DESC, record_time DESC`,
  ).bind(user.email).all<RecordRow>();
  return Response.json(result.results.map(toClient));
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.formData();
  const id = crypto.randomUUID();
  const date = String(body.get("date") || "");
  const time = String(body.get("time") || "");
  const location = String(body.get("location") || "");
  const showLocation = String(body.get("showLocation")) === "true";
  const visibility = body.get("visibility") === "friends" ? "friends" : "private";
  const food = String(body.get("food") || "오늘의 한 끼").slice(0, 80);
  const mealType = ["delivery", "dining", "home"].includes(String(body.get("mealType"))) ? String(body.get("mealType")) : "home";
  const expense = mealType === "home" ? 0 : Math.max(0, Number(body.get("expense")) || 0);
  const memo = String(body.get("memo") || "").slice(0, 300);
  const photo = body.get("photo");
  const { DB, PHOTOS } = bindings();
  let imageKey: string | null = null;

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 10 * 1024 * 1024) {
      return Response.json({ error: "사진은 10MB 이하만 올릴 수 있어요." }, { status: 413 });
    }
    imageKey = `${user.email}/${id}`;
    await PHOTOS.put(imageKey, await photo.arrayBuffer(), {
      httpMetadata: { contentType: photo.type || "image/jpeg" },
    });
  }

  await DB.prepare(
    `INSERT INTO records
     (id, owner_email, record_date, record_time, location, show_location, visibility, food, meal_type, expense, memo, image_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    user.email,
    date,
    time,
    location,
    showLocation ? 1 : 0,
    visibility,
    food,
    mealType,
    expense,
    memo,
    imageKey,
    Date.now(),
  ).run();

  return Response.json(toClient({
    id,
    record_date: date,
    record_time: time,
    location,
    show_location: showLocation ? 1 : 0,
    visibility,
    food,
    meal_type: mealType as "delivery" | "dining" | "home",
    expense,
    memo,
    image_key: imageKey,
  }), { status: 201 });
}
