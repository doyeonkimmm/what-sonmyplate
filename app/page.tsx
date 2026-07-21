"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type MealType = "아침" | "점심" | "저녁" | "간식";
type Step = "photo" | "time" | "doodle" | "details";
type Overlay = Step | "gallery" | "calendar" | null;

type MealRecord = {
  id: string;
  date: string;
  mealType: MealType;
  foodName: string;
  note: string;
  doodle: string;
  photo: string | null;
};

const DOODLES = [
  { value: "🍚", label: "밥", color: "yellow" },
  { value: "🍜", label: "면", color: "red" },
  { value: "🍞", label: "빵", color: "cream" },
  { value: "🥗", label: "채소", color: "green" },
  { value: "🍎", label: "과일", color: "red" },
  { value: "🍰", label: "디저트", color: "pink" },
  { value: "🥤", label: "음료", color: "blue" },
  { value: "🍽️", label: "기타", color: "cream" },
];

const MEALS: MealType[] = ["아침", "점심", "저녁", "간식"];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [...Array.from({ length: first }, () => null), ...Array.from({ length: last }, (_, i) => i + 1)];
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" })
    .format(new Date(`${value}T12:00:00`));
}

export default function Home() {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [step, setStep] = useState<Step>("photo");
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [mealType, setMealType] = useState<MealType>("점심");
  const [doodle, setDoodle] = useState("🍚");
  const [foodName, setFoodName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(localDateString);
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(localDateString);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (overlay !== "photo" || !cameraMode) return;
    let active = true;
    setCameraError("");

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (stream) => {
        if (!active) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      })
      .catch(() => setCameraError("카메라 권한을 확인해주세요."));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [overlay, cameraMode]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, MealRecord[]>();
    records.forEach((record) => map.set(record.date, [...(map.get(record.date) ?? []), record]));
    return map;
  }, [records]);

  function advance(next: Step) {
    setStep(next);
    setOverlay(next);
  }

  function finishPhoto(value: string) {
    setPhoto(value);
    setCameraMode(false);
    advance("time");
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => finishPhoto(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    finishPhoto(canvas.toDataURL("image/jpeg", 0.86));
  }

  function selectMeal(value: MealType) {
    setMealType(value);
    advance("doodle");
  }

  function selectDoodle(value: string) {
    setDoodle(value);
    advance("details");
  }

  function saveRecord(event: FormEvent) {
    event.preventDefault();
    if (!foodName.trim()) return;
    setRecords((current) => [{
      id: `${Date.now()}`,
      date,
      mealType,
      foodName: foodName.trim(),
      note: note.trim(),
      doodle,
      photo,
    }, ...current]);
    setOverlay(null);
    setStep("photo");
    setPhoto(null);
    setFoodName("");
    setNote("");
  }

  const cells = monthCells(month);
  const selectedRecords = recordsByDate.get(selectedDate) ?? [];
  const stepOrder: Step[] = ["photo", "time", "doodle", "details"];
  const stepLabels = { photo: "사진", time: "시간", doodle: "그림", details: "기록" };

  return (
    <main className="kitchen-app">
      <header className="kitchen-header">
        <div className="brand-mark">오늘<br />모먹지</div>
        <div className="date-ticket">{readableDate(date)}</div>
      </header>

      <nav className="flow-strip" aria-label="기록 순서">
        {stepOrder.map((item, index) => (
          <button
            className={`${step === item ? "active" : ""} ${stepOrder.indexOf(step) > index ? "done" : ""}`}
            key={item}
            onClick={() => { setStep(item); setOverlay(item); }}
            type="button"
          >
            <span>{index + 1}</span>{stepLabels[item]}
          </button>
        ))}
      </nav>

      <section className="kitchen-scene" aria-label="나의 부엌">
        <div className="wall-pattern" aria-hidden="true" />

        <button className="wall-calendar" onClick={() => setOverlay("calendar")} type="button">
          <span>JUL.</span>
          <b>{new Date().getDate()}</b>
          <small>달력</small>
        </button>

        <button className={`wall-clock ${step === "time" ? "attention" : ""}`} onClick={() => setOverlay("time")} type="button">
          <i /><b>{mealType}</b><small>시간</small>
        </button>

        <div className="window-frame" aria-hidden="true"><div /><div /></div>

        <div className="fridge">
          <div className="fridge-handle" />
          <button className={`fridge-magnets ${step === "doodle" ? "attention" : ""}`} onClick={() => setOverlay("doodle")} type="button" aria-label="손그림 선택">
            <span>🍚</span><span>🍜</span><span>🍞</span><span>🍎</span>
            <small>손그림</small>
          </button>
          <button className="fridge-photo" onClick={() => setOverlay("gallery")} type="button" aria-label="갤러리 열기">
            {photo ? <img src={photo} alt="현재 음식" /> : <span>PHOTO</span>}
            <small>갤러리</small>
          </button>
        </div>

        <div className="counter" aria-hidden="true" />

        <button className={`camera-object ${step === "photo" ? "attention" : ""}`} onClick={() => { setCameraMode(false); setOverlay("photo"); }} type="button">
          <span className="camera-lens" />
          <b>CAMERA</b>
          {step === "photo" && <em>START!</em>}
        </button>

        <div className="plate-preview" aria-label="선택한 사진">
          {photo ? <img src={photo} alt="선택한 음식" /> : <span>{doodle}</span>}
        </div>

        <button className={`memo-object ${step === "details" ? "attention" : ""}`} onClick={() => setOverlay("details")} type="button">
          <span>TODAY&apos;S<br />MENU</span>
          <i>{foodName || "________"}</i>
          <small>메모</small>
        </button>
      </section>

      {overlay && (
        <div className="overlay-backdrop" role="presentation">
          <section className={`retro-sheet ${overlay === "gallery" ? "gallery-sheet" : ""}`} role="dialog" aria-modal="true" aria-label={overlay}>
            <header className="sheet-header">
              <div>
                {stepOrder.includes(overlay as Step) && <span>STEP {stepOrder.indexOf(overlay as Step) + 1} / 4</span>}
                <h2>{overlay === "photo" ? "사진" : overlay === "time" ? "시간" : overlay === "doodle" ? "손그림" : overlay === "details" ? "오늘의 기록" : overlay === "gallery" ? "FOOD ARCHIVE" : `${month.getMonth() + 1}월`}</h2>
              </div>
              <button className="sheet-close" onClick={() => { setOverlay(null); setCameraMode(false); }} type="button" aria-label="닫기">×</button>
            </header>

            {overlay === "photo" && (
              <div className="photo-step">
                {cameraMode ? (
                  <>
                    {cameraError ? <div className="camera-error">{cameraError}</div> : <video muted playsInline ref={videoRef} />}
                    <button className="big-action" disabled={Boolean(cameraError)} onClick={capturePhoto} type="button">촬영</button>
                  </>
                ) : (
                  <>
                    <div className="instant-photo">{photo ? <img src={photo} alt="선택한 음식" /> : <span>+</span>}</div>
                    <div className="two-actions">
                      <button onClick={() => setCameraMode(true)} type="button">지금 촬영</button>
                      <button onClick={() => uploadRef.current?.click()} type="button">사진 업로드</button>
                    </div>
                    <input className="visually-hidden" ref={uploadRef} onChange={handleUpload} accept="image/*" type="file" />
                  </>
                )}
              </div>
            )}

            {overlay === "time" && (
              <div className="clock-picker">
                <div className="clock-face"><span className="hand" /><b>{mealType}</b></div>
                <div className="meal-buttons">{MEALS.map((item) => <button key={item} onClick={() => selectMeal(item)} type="button">{item}</button>)}</div>
              </div>
            )}

            {overlay === "doodle" && (
              <div className="magnet-board">
                {DOODLES.map((item) => <button className={item.color} key={item.value} onClick={() => selectDoodle(item.value)} type="button"><span>{item.value}</span><small>{item.label}</small></button>)}
              </div>
            )}

            {overlay === "details" && (
              <form className="order-note" onSubmit={saveRecord}>
                <label>날짜<input type="date" max={localDateString()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <label>음식<input required value={foodName} onChange={(event) => setFoodName(event.target.value)} /></label>
                <label>메모<textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label>
                <div className="order-summary"><span>{mealType}</span><span>{doodle}</span><span>{photo ? "PHOTO ✓" : "NO PHOTO"}</span></div>
                <button className="big-action" type="submit">SAVE</button>
              </form>
            )}

            {overlay === "gallery" && (
              <div className="archive-grid">
                {records.length === 0 ? <div className="archive-empty">NO MEALS YET</div> : records.map((record, index) => (
                  <article key={record.id}>
                    <div>{record.photo ? <img src={record.photo} alt={record.foodName} /> : <span>{record.doodle}</span>}</div>
                    <b>({index + 1})</b><small>{record.foodName}</small>
                  </article>
                ))}
              </div>
            )}

            {overlay === "calendar" && (
              <div className="retro-calendar">
                <div className="month-switch"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><strong>{month.getFullYear()}</strong><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button></div>
                <div className="week-labels">{"일월화수목금토".split("").map((day) => <span key={day}>{day}</span>)}</div>
                <div className="calendar-cells">{cells.map((day, index) => {
                  if (!day) return <i key={`blank-${index}`} />;
                  const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const record = recordsByDate.get(key)?.[0];
                  return <button className={selectedDate === key ? "selected" : ""} key={key} onClick={() => setSelectedDate(key)}><span>{day}</span>{record && <b>{record.doodle}</b>}</button>;
                })}</div>
                <div className="calendar-detail"><strong>{readableDate(selectedDate)}</strong>{selectedRecords.length ? selectedRecords.map((record) => <p key={record.id}>{record.doodle} {record.foodName} · {record.mealType}</p>) : <p>기록 없음</p>}</div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
