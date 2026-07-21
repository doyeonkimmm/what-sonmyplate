"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Tab = "record" | "gallery" | "calendar";
type MealType = "아침" | "점심" | "저녁" | "간식";

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
  { value: "🍚", label: "밥" },
  { value: "🍜", label: "면" },
  { value: "🍞", label: "빵" },
  { value: "🥗", label: "샐러드" },
  { value: "🍎", label: "과일" },
  { value: "🍰", label: "디저트" },
  { value: "🥤", label: "음료" },
  { value: "🍽️", label: "기타" },
];

const MEAL_TYPES: MealType[] = ["아침", "점심", "저녁", "간식"];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function monthCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();

  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: lastDate }, (_, index) => index + 1),
  ];
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("record");
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [date, setDate] = useState(localDateString);
  const [mealType, setMealType] = useState<MealType>("점심");
  const [foodName, setFoodName] = useState("");
  const [note, setNote] = useState("");
  const [doodle, setDoodle] = useState(DOODLES[0].value);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [selectedDate, setSelectedDate] = useState(localDateString);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cameraOpen) return;

    let active = true;
    setCameraError("");

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("camera-unavailable");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError(
          "카메라를 열 수 없습니다. 브라우저의 카메라 권한을 확인해주세요.",
        );
      }
    }

    startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, MealRecord[]>();
    records.forEach((record) => {
      const current = map.get(record.date) ?? [];
      map.set(record.date, [...current, record]);
    });
    return map;
  }, [records]);

  const selectedRecords = recordsByDate.get(selectedDate) ?? [];
  const cells = monthCells(visibleMonth);

  function resetForm() {
    setFoodName("");
    setNote("");
    setPhoto(null);
    setMealType("점심");
  }

  function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!foodName.trim()) return;

    const record: MealRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date,
      mealType,
      foodName: foodName.trim(),
      note: note.trim(),
      doodle,
      photo,
    };

    setRecords((current) => [record, ...current]);
    setSelectedDate(date);
    resetForm();
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.86));
    setCameraOpen(false);
  }

  function moveMonth(amount: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  }

  function dateKeyForDay(day: number) {
    const year = visibleMonth.getFullYear();
    const month = String(visibleMonth.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-${String(day).padStart(2, "0")}`;
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <h1>오늘모먹지</h1>
      </header>

      <nav className="main-tabs" aria-label="주요 메뉴">
        <button
          className={tab === "record" ? "active" : ""}
          onClick={() => setTab("record")}
          type="button"
        >
          기록
        </button>
        <button
          className={tab === "gallery" ? "active" : ""}
          onClick={() => setTab("gallery")}
          type="button"
        >
          갤러리
        </button>
        <button
          className={tab === "calendar" ? "active" : ""}
          onClick={() => setTab("calendar")}
          type="button"
        >
          달력
        </button>
      </nav>

      {tab === "record" && (
        <section className="panel record-panel" aria-labelledby="record-title">
          <div className="section-heading">
            <h2 id="record-title">기록</h2>
            <input
              aria-label="기록 날짜"
              className="date-input"
              max={localDateString()}
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </div>

          <form onSubmit={saveRecord}>
            <div className="photo-area">
              {photo ? (
                <div className="photo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="선택한 음식" src={photo} />
                  <button onClick={() => setPhoto(null)} type="button">
                    사진 지우기
                  </button>
                </div>
              ) : (
                <div className="photo-empty" aria-hidden="true">
                  <span>＋</span>
                </div>
              )}

              <div className="photo-actions">
                <button onClick={() => setCameraOpen(true)} type="button">
                  카메라로 촬영
                </button>
                <button onClick={() => uploadRef.current?.click()} type="button">
                  사진 업로드
                </button>
                <input
                  accept="image/*"
                  className="visually-hidden"
                  onChange={handleUpload}
                  ref={uploadRef}
                  type="file"
                />
              </div>
            </div>

            <label className="field">
              <span>음식 이름</span>
              <input
                onChange={(event) => setFoodName(event.target.value)}
                required
                value={foodName}
              />
            </label>

            <fieldset className="field">
              <legend>식사 시간</legend>
              <div className="choice-row meal-choices">
                {MEAL_TYPES.map((item) => (
                  <label key={item}>
                    <input
                      checked={mealType === item}
                      name="meal-type"
                      onChange={() => setMealType(item)}
                      type="radio"
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span>메모</span>
              <textarea
                maxLength={100}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                value={note}
              />
            </label>

            <fieldset className="field">
              <legend>달력에 표시할 손그림</legend>
              <div className="doodle-grid">
                {DOODLES.map((item) => (
                  <label key={item.value}>
                    <input
                      checked={doodle === item.value}
                      name="doodle"
                      onChange={() => setDoodle(item.value)}
                      type="radio"
                    />
                    <span aria-hidden="true">{item.value}</span>
                    <small>{item.label}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <button className="primary-button" type="submit">
              기록 저장하기
            </button>
          </form>
        </section>
      )}

      {tab === "gallery" && (
        <section className="panel" aria-labelledby="gallery-title">
          <div className="section-heading">
            <h2 id="gallery-title">갤러리</h2>
          </div>

          {records.length === 0 ? (
            <div className="empty-state">
              <p>기록 없음</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {records.map((record) => (
                <article className="meal-card" key={record.id}>
                  <div className="meal-card-photo">
                    {record.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={record.foodName} src={record.photo} />
                    ) : (
                      <span aria-hidden="true">{record.doodle}</span>
                    )}
                  </div>
                  <div className="meal-card-body">
                    <small>
                      {readableDate(record.date)} · {record.mealType}
                    </small>
                    <h3>{record.foodName}</h3>
                    {record.note && <p>{record.note}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "calendar" && (
        <section className="panel" aria-labelledby="calendar-title">
          <div className="calendar-heading">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">
              이전
            </button>
            <h2 id="calendar-title">
              {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
            </h2>
            <button aria-label="다음 달" onClick={() => moveMonth(1)} type="button">
              다음
            </button>
          </div>

          <div className="weekday-row" aria-hidden="true">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((day, index) => {
              if (!day) return <span className="calendar-blank" key={`blank-${index}`} />;

              const key = dateKeyForDay(day);
              const dayRecords = recordsByDate.get(key) ?? [];
              const representative = dayRecords[0];

              return (
                <button
                  className={selectedDate === key ? "selected" : ""}
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  type="button"
                >
                  <span>{day}</span>
                  {representative && (
                    <strong aria-label={`${dayRecords.length}개의 식사 기록`}>
                      {representative.doodle}
                    </strong>
                  )}
                </button>
              );
            })}
          </div>

          <div className="day-detail">
            <h3>{readableDate(selectedDate)}</h3>
            {selectedRecords.length === 0 ? (
              <p>기록 없음</p>
            ) : (
              <ul>
                {selectedRecords.map((record) => (
                  <li key={record.id}>
                    <span aria-hidden="true">{record.doodle}</span>
                    <div>
                      <small>{record.mealType}</small>
                      <strong>{record.foodName}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {cameraOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="camera-title"
            aria-modal="true"
            className="camera-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <h2 id="camera-title">카메라</h2>
              <button onClick={() => setCameraOpen(false)} type="button">
                닫기
              </button>
            </div>

            {cameraError ? (
              <div className="camera-error">{cameraError}</div>
            ) : (
              <video muted playsInline ref={videoRef} />
            )}

            <button
              className="primary-button"
              disabled={Boolean(cameraError)}
              onClick={capturePhoto}
              type="button"
            >
              촬영하기
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
