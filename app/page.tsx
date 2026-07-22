"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type Step = "photo" | "time" | "food" | "memo";
type Meal = "아침" | "점심" | "저녁" | "간식";
type SavedRecord = { id: number; photo: string; meal: Meal; food: string; memo: string; date: string };

const meals: Meal[] = ["아침", "점심", "저녁", "간식"];
const foods = ["밥", "면", "국", "빵", "고기", "생선", "샐러드", "과일", "피자", "버거", "케이크", "아이스크림", "음료", "커피", "과자", "기타"];

export default function Home() {
  const [step, setStep] = useState<Step>("photo");
  const [open, setOpen] = useState(false);
  const [camera, setCamera] = useState(false);
  const [photo, setPhoto] = useState("");
  const [meal, setMeal] = useState<Meal>("점심");
  const [food, setFood] = useState("");
  const [memo, setMemo] = useState("");
  const [done, setDone] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!camera) return;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      })
      .catch(() => setCamera(false));
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [camera]);

  useEffect(() => {
    setRecords(JSON.parse(localStorage.getItem("meal-records") || "[]"));
  }, []);

  function next(nextStep: Step) {
    setStep(nextStep);
    setOpen(true);
    setCamera(false);
  }

  function usePhoto(src: string) {
    setPhoto(src);
    next("time");
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => usePhoto(String(reader.result));
    reader.readAsDataURL(file);
  }

  function shoot() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 900 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    usePhoto(canvas.toDataURL("image/jpeg", .78));
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const record = { id: Date.now(), photo, meal, food, memo, date: new Date().toISOString() };
    const nextRecords = [record, ...records].slice(0, 30);
    localStorage.setItem("meal-records", JSON.stringify(nextRecords));
    setRecords(nextRecords);
    setOpen(false);
    setDone(true);
  }

  function reset() {
    setStep("photo"); setPhoto(""); setFood(""); setMemo(""); setDone(false); setOpen(false);
  }

  return (
    <main className="app-shell">
      <section className="kitchen" aria-label="오늘 뭐 먹지 기록 화면">
        <img className="kitchen-bg" src="/frame-1.svg" alt="픽셀 아트 부엌" />
        <button className="calendar-prop sprite-object" onClick={() => setRecordsOpen(true)} aria-label="식사 기록 보기"><span>{records.length || ""}</span></button>

        <button className={`camera-prop lively-sprite ${step === "photo" && !done ? "active ready" : ""}`} onClick={() => { if (step === "photo" && !done) setOpen(true); }} disabled={step !== "photo" || done} aria-label="카메라를 눌러 기록 시작" />

        {photo && <div className="polaroid"><img src={photo} alt="선택한 음식" /></div>}
        {step === "food" && <div className="fridge-hint" aria-hidden="true">★</div>}

        <div className="prompt" aria-live="polite">
          {done ? <><b>기록이 저장됐어요</b><button onClick={reset}>새 기록</button></> : <span>{step === "photo" ? "카메라를 눌러 기록하기" : step === "time" ? "시간을 선택해 주세요" : step === "food" ? "음식을 선택해 주세요" : "메모를 남겨 주세요"}</span>}
        </div>

        {open && <div className="shade">
          <section className="paper" role="dialog" aria-modal="true" aria-label="식사 기록">
            <header><small>{step === "photo" ? "1 / 4" : step === "time" ? "2 / 4" : step === "food" ? "3 / 4" : "4 / 4"}</small><button onClick={() => { setOpen(false); setCamera(false); }} aria-label="닫기">×</button></header>

            {step === "photo" && <div className="photo-step">
              {camera ? <><video ref={videoRef} muted playsInline /><button className="primary" onClick={shoot}>촬영</button></> : <><div className="camera-hero lively-sprite" /><button className="primary" onClick={() => setCamera(true)}>직접 촬영</button><button className="secondary" onClick={() => inputRef.current?.click()}>사진 업로드</button></>}
              <input ref={inputRef} type="file" accept="image/*" onChange={upload} hidden />
            </div>}

            {step === "time" && <div className="choice-grid meal-grid">{meals.map((item, index) => <button key={item} onClick={() => { setMeal(item); next("food"); }}><span className={`ui-sprite meal-${index}`} />{item}</button>)}</div>}

            {step === "food" && <div className="choice-grid food-grid">{foods.map((item, index) => <button key={item} onClick={() => { setFood(item); next("memo"); }}><span className="food-sprite" style={{ backgroundPosition: `${(index % 4) * 33.333}% ${Math.floor(index / 4) * 33.333}%` }} />{item}</button>)}</div>}

            {step === "memo" && <form onSubmit={save} className="memo-form">
              {photo && <img src={photo} alt="음식 미리보기" />}
              <div className="tags"><span>{meal}</span><span>{food}</span></div>
              <label>메모<textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="오늘의 한마디" rows={3} /></label>
              <button className="primary" type="submit">저장</button>
            </form>}
          </section>
        </div>}

        {recordsOpen && <div className="shade">
          <section className="paper record-paper" role="dialog" aria-modal="true" aria-label="식사 기록">
            <header><strong>나의 식사 기록</strong><button onClick={() => setRecordsOpen(false)} aria-label="닫기">×</button></header>
            <div className="record-grid">
              {records.length ? records.map(record => <article key={record.id}>
                {record.photo ? <img src={record.photo} alt={record.food} /> : <div className="empty-photo" />}
                <b>{record.food}</b><small>{record.meal} · {new Date(record.date).toLocaleDateString("ko-KR")}</small>
              </article>) : <p className="empty-record">아직 기록이 없어요</p>}
            </div>
          </section>
        </div>}
      </section>
    </main>
  );
}
