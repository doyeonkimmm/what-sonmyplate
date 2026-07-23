"use client";

import { ChangeEvent, FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type User = { displayName: string; email: string } | null;
type Friend = { id: string; name: string; email: string; color: string };
type RecordItem = {
  id: string;
  day: number;
  month: number;
  year: number;
  time: string;
  location: string;
  showLocation: boolean;
  visibility: "private" | "friends";
  food: string;
  mealType: "delivery" | "dining" | "home";
  expense: number;
  memo: string;
  photoUrl?: string;
  owner?: string;
  tint?: string;
};

const friends: Friend[] = [
  { id: "mira", name: "미라", email: "mira@example.com", color: "#efc3c2" },
  { id: "june", name: "준", email: "june@example.com", color: "#b9dedc" },
  { id: "sol", name: "솔", email: "sol@example.com", color: "#e1dba6" },
];

const friendRecords: RecordItem[] = [
  { id: "f1", owner: "mira", year: 2026, month: 7, day: 5, time: "12:20", location: "성수동", showLocation: true, visibility: "friends", food: "바질 파스타", mealType: "dining", expense: 18000, memo: "오랜만에 발견한 작은 식당", tint: "#efd7ca" },
  { id: "f2", owner: "mira", year: 2026, month: 7, day: 6, time: "18:40", location: "한강", showLocation: false, visibility: "friends", food: "레몬 에이드", mealType: "delivery", expense: 6500, memo: "바람이 시원했던 저녁", tint: "#d7e4b7" },
  { id: "f3", owner: "june", year: 2026, month: 7, day: 5, time: "08:10", location: "집", showLocation: true, visibility: "friends", food: "프렌치 토스트", mealType: "home", expense: 0, memo: "느긋한 일요일 아침", tint: "#f2d6a7" },
  { id: "f4", owner: "june", year: 2026, month: 7, day: 7, time: "14:30", location: "망원동", showLocation: true, visibility: "friends", food: "딸기 케이크", mealType: "dining", expense: 8500, memo: "한 조각만 먹으려 했는데", tint: "#edc0c9" },
  { id: "f5", owner: "sol", year: 2026, month: 7, day: 6, time: "19:10", location: "을지로", showLocation: true, visibility: "friends", food: "비빔면", mealType: "home", expense: 0, memo: "매콤해서 좋았어", tint: "#d7d8b5" },
];

const pad = (value: number) => String(value).padStart(2, "0");
const current = new Date();

export default function JournalApp({ user }: { user: User }) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(7);
  const [selectedDay, setSelectedDay] = useState(5);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<"menu" | "friends" | "roulette" | "stats">("menu");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [activeFriend, setActiveFriend] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [formDate, setFormDate] = useState("2026-07-05");
  const [formTime, setFormTime] = useState("12:00");
  const [location, setLocation] = useState("");
  const [showLocation, setShowLocation] = useState(true);
  const [visibility, setVisibility] = useState<"private" | "friends">("private");
  const [food, setFood] = useState("");
  const [mealType, setMealType] = useState<"delivery" | "dining" | "home">("home");
  const [expense, setExpense] = useState("");
  const [memo, setMemo] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [managedFriends, setManagedFriends] = useState<Friend[]>([]);
  const [rouletteItems, setRouletteItems] = useState(["김치찌개", "파스타", "초밥", "떡볶이"]);
  const [rouletteText, setRouletteText] = useState("");
  const [rouletteResult, setRouletteResult] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Friend | null>(null);
  const [statsStart, setStatsStart] = useState("2026-01");
  const [statsEnd, setStatsEnd] = useState("2026-07");
  const trackRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<Record<number, HTMLElement | null>>({});
  const drag = useRef({ active: false, x: 0, left: 0 });

  const dayCount = new Date(year, month, 0).getDate();
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => index + 1), [dayCount]);
  const ownRecords = records.filter((record) => record.year === year && record.month === month);
  const visibleRecords = activeFriend
    ? friendRecords.filter((record) => record.owner === activeFriend && record.year === year && record.month === month)
    : ownRecords;

  useEffect(() => {
    if (!user) return;
    fetch("/api/records")
      .then((response) => response.ok ? response.json() : [])
      .then((data) => Array.isArray(data) && setRecords(data))
      .catch(() => undefined);
    fetch("/api/friends")
      .then((response) => response.ok ? response.json() : [])
      .then((data) => Array.isArray(data) && setManagedFriends(data))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => scrollToDay(selectedDay, "auto"), 60);
    return () => window.clearTimeout(timer);
    // The selected date controls the horizontal journal position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, activeFriend]);

  function scrollToDay(day: number, behavior: ScrollBehavior = "smooth") {
    const target = dayRefs.current[day];
    if (!target) return;
    setSelectedDay(day);
    target.scrollIntoView({ behavior, inline: "start", block: "nearest" });
  }

  function goToday() {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDay(today.getDate());
    window.setTimeout(() => scrollToDay(today.getDate()), 80);
  }

  function changeMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setSelectedDay(1);
  }

  function openPhoto(day = selectedDay) {
    const now = new Date();
    setFormDate(`${year}-${pad(month)}-${pad(day)}`);
    setFormTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setPhotoOpen(true);
  }

  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
    const shot = new Date(file.lastModified || Date.now());
    setFormDate(`${shot.getFullYear()}-${pad(shot.getMonth() + 1)}-${pad(shot.getDate())}`);
    setFormTime(`${pad(shot.getHours())}:${pad(shot.getMinutes())}`);
    if (navigator.geolocation) {
      setLocation("현재 위치 확인 중…");
      navigator.geolocation.getCurrentPosition(
        (position) => setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`),
        () => setLocation(""),
        { enableHighAccuracy: false, timeout: 7000 },
      );
    }
  }

  function resetPhotoForm() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setPhotoFile(null);
    setLocation("");
    setFood("");
    setMealType("home");
    setExpense("");
    setMemo("");
    setVisibility("private");
    setShowLocation(true);
  }

  async function saveRecord(event: FormEvent) {
    event.preventDefault();
    const [recordYear, recordMonth, recordDay] = formDate.split("-").map(Number);
    const optimistic: RecordItem = {
      id: String(Date.now()),
      year: recordYear,
      month: recordMonth,
      day: recordDay,
      time: formTime,
      location,
      showLocation,
      visibility,
      food: food.trim() || "오늘의 한 끼",
      mealType,
      expense: mealType === "home" ? 0 : Math.max(0, Number(expense) || 0),
      memo: memo.trim(),
      photoUrl: preview,
      tint: "#e3e1d8",
    };
    setRecords((items) => [optimistic, ...items]);
    setPhotoOpen(false);
    setYear(recordYear);
    setMonth(recordMonth);
    setSelectedDay(recordDay);

    if (user) {
      const body = new FormData();
      if (photoFile) body.append("photo", photoFile);
      body.append("date", formDate);
      body.append("time", formTime);
      body.append("location", location);
      body.append("showLocation", String(showLocation));
      body.append("visibility", visibility);
      body.append("food", food.trim() || "오늘의 한 끼");
      body.append("mealType", mealType);
      body.append("expense", String(mealType === "home" ? 0 : Math.max(0, Number(expense) || 0)));
      body.append("memo", memo.trim());
      try {
        const response = await fetch("/api/records", { method: "POST", body });
        if (response.ok) {
          const saved = await response.json();
          setRecords((items) => items.map((item) => item.id === optimistic.id ? saved : item));
        }
      } catch {
        // Keep the optimistic record visible for this visit.
      }
    }
    window.setTimeout(() => scrollToDay(recordDay), 100);
    resetPhotoForm();
  }

  function onTrackScroll() {
    const track = trackRef.current;
    if (!track || drag.current.active) return;
    const left = track.scrollLeft + 8;
    let nearest = selectedDay;
    let distance = Number.POSITIVE_INFINITY;
    days.forEach((day) => {
      const node = dayRefs.current[day];
      if (!node) return;
      const next = Math.abs(node.offsetLeft - left);
      if (next < distance) {
        distance = next;
        nearest = day;
      }
    });
    if (nearest !== selectedDay) setSelectedDay(nearest);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    drag.current = { active: true, x: event.clientX, left: track.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active || !trackRef.current) return;
    const distance = event.clientX - drag.current.x;
    if (Math.abs(distance) < 2) return;
    trackRef.current.scrollLeft = drag.current.left - distance;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    drag.current.active = false;
    trackRef.current?.releasePointerCapture(event.pointerId);
    onTrackScroll();
  }

  async function addFriend(event: FormEvent) {
    event.preventDefault();
    const email = friendEmail.trim();
    if (!email) return;
    const optimistic = { id: `custom-${Date.now()}`, name: email.split("@")[0], email, color: "#d5cde2" };
    setManagedFriends((items) => [...items, optimistic]);
    setFriendEmail("");
    if (user) {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: email }),
      }).catch(() => null);
      if (response?.ok) {
        const saved = await response.json();
        setManagedFriends((items) => items.map((item) => item.id === optimistic.id ? saved : item));
      }
    }
  }

  async function removeFriend(friend: Friend) {
    setManagedFriends((items) => items.filter((item) => item.id !== friend.id));
    if (user) {
      await fetch(`/api/friends?id=${encodeURIComponent(friend.id)}`, { method: "DELETE" }).catch(() => undefined);
    }
  }

  function spinRoulette() {
    if (!rouletteItems.length || spinning) return;
    setSpinning(true);
    setRouletteResult("");
    window.setTimeout(() => {
      setRouletteResult(rouletteItems[Math.floor(Math.random() * rouletteItems.length)]);
      setSpinning(false);
    }, 1150);
  }

  const monthStart = new Date(year, month - 1, 1).getDay();
  const calendarCells = [...Array(monthStart).fill(null), ...days];
  const rangedRecords = records.filter((item) => {
    const key = `${item.year}-${pad(item.month)}`;
    return key >= statsStart && key <= statsEnd;
  });
  const stats = Object.entries(rangedRecords.reduce<Record<string, number>>((acc, item) => {
    acc[item.food] = (acc[item.food] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const typeCounts = rangedRecords.reduce((acc, item) => {
    acc[item.mealType] = (acc[item.mealType] || 0) + 1;
    return acc;
  }, { delivery: 0, dining: 0, home: 0 } as Record<"delivery" | "dining" | "home", number>);
  const totalExpense = rangedRecords.reduce((sum, item) => sum + (item.expense || 0), 0);
  const activeFriendData = managedFriends.find((friend) => friend.id === activeFriend);
  const headerFriends = managedFriends.length > 3 ? managedFriends.slice(0, 2) : managedFriends;
  const rouletteColors = ["#efc3c2", "#b9dedc", "#e1dba6", "#d3cdc5"];
  const rouletteBackground = `conic-gradient(${rouletteItems.map((_, index) => {
    const start = (index / rouletteItems.length) * 360;
    const end = ((index + 1) / rouletteItems.length) * 360;
    return `${rouletteColors[index % rouletteColors.length]} ${start}deg ${end}deg`;
  }).join(", ") || "#f1f1ee 0deg 360deg"})`;

  return (
    <main className="site-stage">
      <section className="app-frame">
        <header className="journal-header">
          <div className="calendar-block">
            <div className="calendar-nav">
              <button onClick={() => changeMonth(-1)} aria-label="이전 달"><img src="/ui/frame-9.svg" alt="" /></button>
              <span />
              <button onClick={() => changeMonth(1)} aria-label="다음 달"><img src="/ui/frame-10.svg" alt="" /></button>
            </div>
            <div className="week-labels">{["S", "M", "T", "W", "T", "F", "S"].map((label, index) => <b key={`${label}-${index}`}>{label}</b>)}</div>
            <div className="mini-calendar">
              {calendarCells.map((day, index) => day ? (
                <button key={day} className={`${day === selectedDay ? "active" : ""} ${visibleRecords.some((record) => record.day === day) ? "has-record" : ""} ${day === current.getDate() && month === current.getMonth() + 1 && year === current.getFullYear() ? "current" : ""}`} onClick={() => scrollToDay(day)}>
                  {day}
                </button>
              ) : <span key={`blank-${index}`} />)}
            </div>
          </div>

          <div className="header-tools">
            <div className="tool-row">
              <button className="today-sketch" onClick={goToday}>today</button>
              <button className="menu-sketch" onClick={() => { setDrawerOpen(true); setDrawerView("menu"); }} aria-label="더보기"><img src="/ui/frame-2.svg" alt="" /></button>
            </div>
            <div className="year-month"><b>{year}</b><b>{pad(month)}</b></div>
            <div className="friend-row" aria-label="친구 기록장">
              {managedFriends.length === 0 && (
                <button
                  className="friend-empty"
                  onClick={() => { setDrawerOpen(true); setDrawerView("friends"); }}
                  aria-label="친구 추가"
                >＋</button>
              )}
              {headerFriends.map((friend) => (
                <button
                  key={friend.id}
                  className={activeFriend === friend.id ? "active" : ""}
                  style={{ "--avatar": friend.color } as React.CSSProperties}
                  onClick={() => setActiveFriend((value) => value === friend.id ? null : friend.id)}
                  aria-label={`${friend.name}의 기록장 보기`}
                >
                  <span /><i />
                </button>
              ))}
              {managedFriends.length > 3 && (
                <button
                  className="friend-overflow"
                  onClick={() => { setDrawerOpen(true); setDrawerView("friends"); }}
                  aria-label={`친구 ${managedFriends.length - 2}명 더 보기`}
                >+{managedFriends.length - 2}</button>
              )}
            </div>
          </div>
        </header>

        {activeFriendData && (
          <div className="friend-banner">
            <span>{activeFriendData.name}의 기록장</span>
            <button onClick={() => setActiveFriend(null)}>내 기록장으로</button>
          </div>
        )}

        <div
          className="record-track"
          ref={trackRef}
          onScroll={onTrackScroll}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {days.map((day) => {
            const dayRecords = visibleRecords.filter((record) => record.day === day).sort((a, b) => a.time.localeCompare(b.time));
            return (
              <article className="day-sheet" key={day} ref={(node) => { dayRefs.current[day] = node; }}>
                <header>
                  <b>{pad(day)}</b>
                  {!activeFriend && day === selectedDay && <button className="track-add" onPointerDown={(event) => event.stopPropagation()} onClick={() => openPhoto(day)} aria-label={`${day}일에 사진 추가`}><img src="/ui/frame-1.svg" alt="" /></button>}
                </header>
                <div className="day-content">
                  {dayRecords.map((record) => (
                    <figure className="record-card" key={record.id}>
                      {record.photoUrl ? <img src={record.photoUrl} alt={record.food} draggable={false} /> : <div className="record-placeholder" style={{ background: record.tint }}><span>◌</span></div>}
                      <figcaption>
                        <b>{record.food}</b>
                        <p>{record.memo}</p>
                        <small>{record.time}{record.showLocation && record.location ? ` · ${record.location}` : ""}</small>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        {photoOpen && (
          <div className="photo-layer">
            <header className="photo-mini-head">
              <button onClick={() => { setPhotoOpen(false); resetPhotoForm(); }}>‹</button>
              <span>사진 추가</span>
              <i />
            </header>
            <form onSubmit={saveRecord}>
              <label className={`photo-drop ${preview ? "with-image" : ""}`}>
                {preview ? <img src={preview} alt="추가할 사진" /> : <><b>사진 추가</b><small>눌러서 한 장을 골라주세요</small></>}
                <input type="file" accept="image/*" onChange={onPhoto} hidden />
              </label>
              <label className="line-field"><span>날짜 &amp; 시간</span><div><input type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} /><input type="time" value={formTime} onChange={(event) => setFormTime(event.target.value)} /></div></label>
              <label className="line-field"><span>위치</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="자동 입력 또는 직접 작성" /></label>
              <label className="line-field"><span>음식 이름</span><input value={food} onChange={(event) => setFood(event.target.value)} placeholder="무엇을 먹었나요?" /></label>
              <div className="meal-type-field choice-field">
                <span className="choice-label">식사 유형</span>
                <div className="choice-options">
                  <button type="button" className={mealType === "delivery" ? "active" : ""} onClick={() => setMealType("delivery")}>배달</button>
                  <button type="button" className={mealType === "dining" ? "active" : ""} onClick={() => setMealType("dining")}>외식</button>
                  <button type="button" className={mealType === "home" ? "active" : ""} onClick={() => setMealType("home")}>집밥</button>
                </div>
              </div>
              {mealType !== "home" && <label className="line-field"><span>지출</span><input type="number" min="0" step="100" value={expense} onChange={(event) => setExpense(event.target.value)} placeholder="얼마를 썼나요?" /></label>}
              <div className="visibility-field choice-field">
                <span className="choice-label">공개 범위</span>
                <div className="choice-options">
                  <button type="button" className={visibility === "private" ? "active" : ""} onClick={() => setVisibility("private")}>나만 보기</button>
                  <button type="button" className={visibility === "friends" ? "active" : ""} onClick={() => setVisibility("friends")}>친구에게 공개</button>
                </div>
                <label><input type="checkbox" checked={showLocation} onChange={(event) => setShowLocation(event.target.checked)} /> 위치 표시</label>
              </div>
              <label className="memo-field"><span>한 줄 메모</span><textarea rows={3} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="이 순간을 한마디로…" /></label>
              <div className="form-actions">
                <button type="button" onClick={() => { setPhotoOpen(false); resetPhotoForm(); }}>취소</button>
                <button type="submit">기록하기</button>
              </div>
            </form>
          </div>
        )}

        <div className={`drawer-shade ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
        <aside className={`more-drawer ${drawerOpen ? "open" : ""}`} aria-hidden={!drawerOpen}>
          <header>
            {drawerView !== "menu" ? <button onClick={() => setDrawerView("menu")}>‹</button> : <span />}
            <button className="menu-sketch" onClick={() => setDrawerOpen(false)} aria-label="닫기"><img src="/ui/frame-2.svg" alt="" /></button>
          </header>

          {drawerView === "menu" && (
            <nav>
              {user ? (
                <button className="account-row" onClick={async () => { await fetch("/api/auth", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"logout" }) }); location.reload(); }}><span>{user.displayName}</span><small>로그아웃</small></button>
              ) : (
                <a href="/signin-with-chatgpt?return_to=%2F">로그인 &amp; 회원가입</a>
              )}
              <button onClick={() => setDrawerView("friends")}>친구 관리</button>
              <button onClick={() => setDrawerView("roulette")}>룰렛 돌리기</button>
              <button onClick={() => setDrawerView("stats")}>통계</button>
            </nav>
          )}

          {drawerView === "friends" && (
            <section className="drawer-panel">
              <h2>친구 관리</h2>
              <form onSubmit={addFriend}><input value={friendEmail} onChange={(event) => setFriendEmail(event.target.value)} placeholder="친구 아이디" /><button>추가</button></form>
              <div className="friend-list">{managedFriends.map((friend) => <div key={friend.id}><i style={{ background: friend.color }} /><span><b>{friend.name}</b><small>{friend.email}</small></span><button onClick={() => setPendingDelete(friend)}>×</button></div>)}</div>
            </section>
          )}

          {drawerView === "roulette" && (
            <section className="drawer-panel roulette-panel">
              <h2>오늘 뭐 먹지?</h2>
              <div className={`roulette-wheel ${spinning ? "spinning" : ""}`} style={{ background: rouletteBackground }}><span>{rouletteResult || "?"}</span></div>
              <button className="spin-button" onClick={spinRoulette}>{spinning ? "고르는 중…" : "돌리기"}</button>
              <form onSubmit={(event) => { event.preventDefault(); if (rouletteText.trim()) { setRouletteItems((items) => [...items, rouletteText.trim()]); setRouletteText(""); } }}>
                <input value={rouletteText} onChange={(event) => setRouletteText(event.target.value)} placeholder="메뉴 추가" />
                <button>＋</button>
              </form>
              <div className="roulette-tags">{rouletteItems.map((item) => <button key={item} onClick={() => setRouletteItems((items) => items.filter((value) => value !== item))}>{item} ×</button>)}</div>
            </section>
          )}

          {drawerView === "stats" && (
            <section className="drawer-panel stats-panel">
              <h2>나의 음식 통계</h2>
              <div className="stat-range"><label>시작<input type="month" value={statsStart} max={statsEnd} onChange={(event) => setStatsStart(event.target.value)} /></label><label>종료<input type="month" value={statsEnd} min={statsStart} onChange={(event) => setStatsEnd(event.target.value)} /></label></div>
              <div className="stat-summary"><b>{rangedRecords.length}</b><span>번의 식사 기록</span></div>
              <div className="type-stats">
                <div><b>{typeCounts.delivery}</b><span>배달</span></div>
                <div><b>{typeCounts.dining}</b><span>외식</span></div>
                <div><b>{typeCounts.home}</b><span>집밥</span></div>
              </div>
              <div className="expense-total"><span>총지출</span><b>{totalExpense.toLocaleString("ko-KR")}원</b></div>
              {stats.length ? stats.slice(0, 6).map(([name, count], index) => (
                <div className="stat-row" key={name}><span>{pad(index + 1)} {name}</span><i><b style={{ width: `${Math.max(18, (count / stats[0][1]) * 100)}%` }} /></i><small>{count}회</small></div>
              )) : <p className="empty-stats">사진을 추가하면 자주 먹은 음식이 여기에 보여요.</p>}
            </section>
          )}

          {pendingDelete && (
            <div className="delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
              <div>
                <b id="delete-title">정말 삭제하시겠습니까?</b>
                <p>{pendingDelete.name}님을 친구 목록에서 삭제합니다.</p>
                <span>
                  <button onClick={() => setPendingDelete(null)}>취소</button>
                  <button onClick={() => { removeFriend(pendingDelete); setPendingDelete(null); }}>삭제</button>
                </span>
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
