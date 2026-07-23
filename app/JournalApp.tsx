"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type User = { displayName: string; email: string; username: string } | null;
type Friend = { id: string; name: string; email: string; color: string; favorite: boolean };
type Suggestion = {
  id: string;
  username: string;
  nickname: string;
  content: string;
  status: "pending" | "done";
  createdAt: number;
};
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

const pad = (value: number) => String(value).padStart(2, "0");

function getKoreaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("사진을 불러오지 못했어요."));
      image.src = sourceUrl;
    });
    const maxSide = 480;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.58));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function JournalApp({ user }: { user: User }) {
  const initialNow = getKoreaNow();
  const [year, setYear] = useState(initialNow.year);
  const [month, setMonth] = useState(initialNow.month);
  const [selectedDay, setSelectedDay] = useState(initialNow.day);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<"menu" | "profile" | "friends" | "roulette" | "stats" | "suggestions">("menu");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [activeFriend, setActiveFriend] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [formDate, setFormDate] = useState(`${initialNow.year}-${pad(initialNow.month)}-${pad(initialNow.day)}`);
  const [formTime, setFormTime] = useState(`${pad(initialNow.hour)}:${pad(initialNow.minute)}`);
  const [location, setLocation] = useState("");
  const [showLocation, setShowLocation] = useState(true);
  const [visibility, setVisibility] = useState<"private" | "friends">("private");
  const [food, setFood] = useState("");
  const [mealType, setMealType] = useState<"delivery" | "dining" | "home">("home");
  const [expense, setExpense] = useState("");
  const [memo, setMemo] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [friendMessage, setFriendMessage] = useState("");
  const [managedFriends, setManagedFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friend[]>([]);
  const [sharedRecords, setSharedRecords] = useState<RecordItem[]>([]);
  const [rouletteItems, setRouletteItems] = useState(["김치찌개", "파스타", "초밥", "떡볶이"]);
  const [rouletteText, setRouletteText] = useState("");
  const [rouletteResult, setRouletteResult] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Friend | null>(null);
  const [statsStart, setStatsStart] = useState(`${initialNow.year}-01`);
  const [statsEnd, setStatsEnd] = useState(`${initialNow.year}-${pad(initialNow.month)}`);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [nicknameDraft, setNicknameDraft] = useState(user?.displayName || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<Record<number, HTMLElement | null>>({});

  const dayCount = new Date(year, month, 0).getDate();
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => index + 1), [dayCount]);
  const ownRecords = records.filter((record) => record.year === year && record.month === month);
  const visibleRecords = activeFriend
    ? sharedRecords.filter((record) => record.year === year && record.month === month)
    : ownRecords;

  async function loadAppData(showMessage = false) {
    if (!user) return;
    const [recordResponse, friendResponse, requestResponse, profileResponse] = await Promise.all([
      fetch("/api/records", { cache: "no-store" }).catch(() => null),
      fetch("/api/friends", { cache: "no-store" }).catch(() => null),
      fetch("/api/friends?requests=1", { cache: "no-store" }).catch(() => null),
      fetch("/api/auth?me=1", { cache: "no-store" }).catch(() => null),
    ]);
    const [recordData, friendData, requestData, profileData] = await Promise.all([
      recordResponse?.ok ? recordResponse.json() : [],
      friendResponse?.ok ? friendResponse.json() : [],
      requestResponse?.ok ? requestResponse.json() : [],
      profileResponse?.ok ? profileResponse.json() : null,
    ]);
    if (Array.isArray(recordData)) setRecords(recordData);
    if (Array.isArray(friendData)) {
      setManagedFriends(friendData);
      if (activeFriend && !friendData.some((friend: Friend) => friend.id === activeFriend)) setActiveFriend(null);
    }
    if (Array.isArray(requestData)) setFriendRequests(requestData);
    if (profileData?.displayName) {
      setDisplayName(profileData.displayName);
      setNicknameDraft(profileData.displayName);
    }
    if (showMessage) {
      setRefreshMessage("새로고침 완료");
      window.setTimeout(() => setRefreshMessage(""), 1400);
    }
  }

  async function loadSuggestions() {
    if (user?.username !== "doyeon") return;
    const response = await fetch("/api/suggestions", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    if (Array.isArray(data)) setSuggestions(data);
  }

  useEffect(() => {
    void loadAppData();
    // Initial account data load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!activeFriend) {
      setSharedRecords([]);
      return;
    }
    fetch(`/api/records?friendId=${encodeURIComponent(activeFriend)}`)
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setSharedRecords(Array.isArray(data) ? data : []))
      .catch(() => setSharedRecords([]));
  }, [activeFriend]);

  useEffect(() => {
    if (drawerOpen && drawerView === "suggestions") void loadSuggestions();
    // The administrator list is fetched only while its drawer is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, drawerView]);

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
    const today = getKoreaNow();
    setYear(today.year);
    setMonth(today.month);
    setSelectedDay(today.day);
    window.setTimeout(() => scrollToDay(today.day), 80);
  }

  function changeMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setSelectedDay(1);
  }

  function openPhoto(day = selectedDay) {
    const now = getKoreaNow();
    setFormDate(`${year}-${pad(month)}-${pad(day)}`);
    setFormTime(`${pad(now.hour)}:${pad(now.minute)}`);
    setPhotoOpen(true);
  }

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const optimized = await compressPhoto(file).catch(() => file);
    if (preview) URL.revokeObjectURL(preview);
    setPhotoFile(optimized);
    setPreview(URL.createObjectURL(optimized));
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
    if (!track) return;
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

  async function addFriend(event: FormEvent) {
    event.preventDefault();
    const username = friendEmail.trim();
    if (!username || !user) return;
    setFriendMessage("");
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    }).catch(() => null);
    if (!response) return setFriendMessage("친구를 확인하지 못했어요.");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setFriendMessage(data.error || "친구를 추가하지 못했어요.");
    setFriendEmail("");
    setFriendMessage(`${data.name}님에게 친구 요청을 보냈어요.`);
  }

  async function answerFriendRequest(request: Friend, action: "accept" | "reject") {
    setFriendMessage("");
    const response = await fetch("/api/friends", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: request.id, action }),
    }).catch(() => null);
    if (!response?.ok) return setFriendMessage("친구 요청을 처리하지 못했어요.");
    setFriendRequests((items) => items.filter((item) => item.id !== request.id));
    if (action === "accept") {
      const friend = await response.json();
      setManagedFriends((items) => [...items, friend]);
      setFriendMessage(`${friend.name}님과 친구가 되었어요.`);
    } else {
      setFriendMessage("친구 요청을 거절했어요.");
    }
  }

  async function removeFriend(friend: Friend) {
    setManagedFriends((items) => items.filter((item) => item.id !== friend.id));
    if (user) {
      await fetch(`/api/friends?id=${encodeURIComponent(friend.id)}`, { method: "DELETE" }).catch(() => undefined);
    }
  }

  async function toggleFavorite(friend: Friend) {
    const next = !friend.favorite;
    setFriendMessage("");
    if (next && managedFriends.filter((item) => item.favorite).length >= 2) {
      return setFriendMessage("즐겨찾기는 최대 2명까지 가능해요.");
    }
    const response = await fetch("/api/friends", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: friend.id, action: "favorite", favorite: next }),
    }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) return setFriendMessage(data?.error || "즐겨찾기를 변경하지 못했어요.");
    setManagedFriends((items) => items
      .map((item) => item.id === friend.id ? { ...item, favorite: next } : item)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite)));
  }

  async function changeNickname(event: FormEvent) {
    event.preventDefault();
    setProfileMessage("");
    const response = await fetch("/api/auth", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: nicknameDraft }),
    }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) return setProfileMessage(data?.error || "닉네임을 변경하지 못했어요.");
    setDisplayName(data.displayName);
    setNicknameDraft(data.displayName);
    setProfileMessage("닉네임을 변경했어요.");
  }

  async function submitSuggestion(event: FormEvent) {
    event.preventDefault();
    setSuggestionMessage("");
    const response = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: suggestionText }),
    }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) return setSuggestionMessage(data?.error || "건의사항을 보내지 못했어요.");
    setSuggestionText("");
    setSuggestionMessage("건의사항을 보냈어요.");
    if (user?.username === "doyeon") void loadSuggestions();
  }

  async function updateSuggestionStatus(item: Suggestion) {
    const status = item.status === "pending" ? "done" : "pending";
    const response = await fetch("/api/suggestions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, status }),
    }).catch(() => null);
    if (!response?.ok) return;
    setSuggestions((items) => items.map((value) => value.id === item.id ? { ...value, status } : value));
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
  const headerFriends = [...managedFriends]
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
    .slice(0, 2);
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
                <button key={day} className={`${day === selectedDay ? "active" : ""} ${visibleRecords.some((record) => record.day === day) ? "has-record" : ""} ${day === initialNow.day && month === initialNow.month && year === initialNow.year ? "current" : ""}`} onClick={() => scrollToDay(day)}>
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
                >add friend</button>
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
              {managedFriends.length > 2 && (
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
        >
          {days.map((day) => {
            const dayRecords = visibleRecords.filter((record) => record.day === day).sort((a, b) => a.time.localeCompare(b.time));
            return (
              <article className="day-sheet" key={day} ref={(node) => { dayRefs.current[day] = node; }}>
                <header>
                  <b>{pad(day)}</b>
                  {!activeFriend && day === selectedDay && <button className="track-add" onClick={() => openPhoto(day)} aria-label={`${day}일에 사진 추가`}><img src="/ui/frame-1.svg" alt="" /></button>}
                </header>
                <div className="day-content">
                  {dayRecords.map((record) => (
                    <figure className="record-card" key={record.id}>
                      {record.photoUrl ? <img src={record.photoUrl} alt={record.food} draggable={false} /> : <div className="record-placeholder" style={{ background: record.tint }}><span>◌</span></div>}
                      <figcaption>
                        <b>{record.food}</b>
                        <p>{record.memo}</p>
                        <small>{record.time}{record.showLocation && record.location ? ` · ${record.location}` : ""}</small>
                        {record.expense > 0 && <small className="record-expense">{record.expense.toLocaleString("ko-KR")}원</small>}
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
              <label className="line-field"><span>위치</span><input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
              <label className="line-field"><span>음식 이름</span><input value={food} onChange={(event) => setFood(event.target.value)} /></label>
              <div className="visibility-field choice-field">
                <span className="choice-label">공개 범위</span>
                <div className="choice-options">
                  <button type="button" className={visibility === "private" ? "active" : ""} onClick={() => setVisibility("private")}>나만 보기</button>
                  <button type="button" className={visibility === "friends" ? "active" : ""} onClick={() => setVisibility("friends")}>친구에게 공개</button>
                </div>
              </div>
              <div className="meal-type-field choice-field">
                <span className="choice-label">식사 유형</span>
                <div className="choice-options">
                  <div className="meal-buttons">
                    <button type="button" className={mealType === "home" ? "active" : ""} onClick={() => setMealType("home")}>집밥</button>
                    <button type="button" className={mealType === "delivery" ? "active" : ""} onClick={() => setMealType("delivery")}>배달</button>
                    <button type="button" className={mealType === "dining" ? "active" : ""} onClick={() => setMealType("dining")}>외식</button>
                  </div>
                  {mealType !== "home" && (
                    <label className="expense-inline">
                      <span>금액</span>
                      <input type="number" min="0" step="100" value={expense} onChange={(event) => setExpense(event.target.value)} inputMode="numeric" placeholder="0" />
                      <b>원</b>
                    </label>
                  )}
                </div>
              </div>
              <label className="memo-field"><span>한 줄 메모</span><textarea rows={3} value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
              <div className="form-actions">
                <button type="button" onClick={() => { setPhotoOpen(false); resetPhotoForm(); }}>취소</button>
                <button type="submit">저장</button>
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
                <button className="account-row" onClick={() => setDrawerView("profile")}><span>{displayName}</span><small>닉네임 변경</small></button>
              ) : (
                <a href="/signin-with-chatgpt?return_to=%2F">로그인 &amp; 회원가입</a>
              )}
              <button onClick={async () => {
                await fetch("/api/auth", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"logout" }) }).catch(() => null);
                window.location.replace("/");
              }}>로그아웃</button>
              <button onClick={() => setDrawerView("friends")}>친구 관리</button>
              <button onClick={() => setDrawerView("roulette")}>룰렛 돌리기</button>
              <button onClick={() => setDrawerView("stats")}>통계</button>
              <button onClick={() => void loadAppData(true)}>새로고침</button>
              <button onClick={() => setDrawerView("suggestions")}>건의사항</button>
              {refreshMessage && <output className="refresh-message">{refreshMessage}</output>}
            </nav>
          )}

          {drawerView === "profile" && (
            <section className="drawer-panel profile-panel">
              <h2>닉네임 변경</h2>
              <form onSubmit={changeNickname}>
                <input minLength={2} maxLength={12} value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} placeholder="새 닉네임" required />
                <button>변경</button>
              </form>
              <small>닉네임은 2~12자로 입력해 주세요.</small>
              {profileMessage && <output className="friend-message">{profileMessage}</output>}
            </section>
          )}

          {drawerView === "friends" && (
            <section className="drawer-panel">
              <h2>친구 관리</h2>
              <form onSubmit={addFriend}><input value={friendEmail} onChange={(event) => setFriendEmail(event.target.value)} placeholder="친구 아이디" /><button>추가</button></form>
              {friendMessage && <output className="friend-message">{friendMessage}</output>}
              {friendRequests.length > 0 && <div className="friend-requests">
                <h3>받은 친구 요청</h3>
                {friendRequests.map((request) => <div key={request.id}>
                  <span><b>{request.name}</b><small>{request.email}</small></span>
                  <button onClick={() => answerFriendRequest(request, "accept")}>수락</button>
                  <button onClick={() => answerFriendRequest(request, "reject")}>거절</button>
                </div>)}
              </div>}
              <div className="friend-list">{managedFriends.map((friend) => <div key={friend.id}>
                <button className="friend-open" onClick={() => { setActiveFriend(friend.id); setDrawerOpen(false); }} aria-label={`${friend.name} 기록장 열기`}>
                  <i style={{ background: friend.color }} />
                  <span><b>{friend.name}</b><small>{friend.email}</small></span>
                </button>
                <button className={`favorite-button ${friend.favorite ? "active" : ""}`} onClick={() => void toggleFavorite(friend)} aria-label={`${friend.name} 즐겨찾기`}>{friend.favorite ? "★" : "☆"}</button>
                <button className="friend-delete" onClick={() => setPendingDelete(friend)} aria-label={`${friend.name} 삭제`}>×</button>
              </div>)}</div>
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

          {drawerView === "suggestions" && (
            <section className="drawer-panel suggestions-panel">
              <h2>건의사항</h2>
              <form onSubmit={submitSuggestion}>
                <textarea maxLength={500} rows={5} value={suggestionText} onChange={(event) => setSuggestionText(event.target.value)} placeholder="불편한 점이나 추가했으면 하는 기능을 적어 주세요." required />
                <button>보내기</button>
              </form>
              {suggestionMessage && <output className="friend-message">{suggestionMessage}</output>}
              {user?.username === "doyeon" && (
                <div className="admin-suggestions">
                  <h3>받은 건의사항</h3>
                  {suggestions.length === 0 ? <p>아직 받은 건의사항이 없어요.</p> : suggestions.map((item) => (
                    <article key={item.id} className={item.status === "done" ? "done" : ""}>
                      <header><b>{item.nickname}</b><small>@{item.username}</small></header>
                      <p>{item.content}</p>
                      <footer>
                        <time>{new Date(item.createdAt).toLocaleString("ko-KR")}</time>
                        <button onClick={() => void updateSuggestionStatus(item)}>{item.status === "done" ? "처리 취소" : "처리 완료"}</button>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
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
