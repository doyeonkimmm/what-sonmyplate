"use client";
import { FormEvent, useState } from "react";

export default function LoginGate() {
  const [mode, setMode] = useState<"login"|"signup"|"recover">("login");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username:"", password:"", email:"", nickname:"" });
  const [message, setMessage] = useState("");
  const set = (key: string, value: string) => setForm(v => ({ ...v, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage("");
    if (mode === "signup" && step < 3) {
      if (step === 1) {
        const r = await fetch(`/api/auth?username=${encodeURIComponent(form.username)}`);
        if (!(await r.json()).available) return setMessage("사용할 수 없는 아이디예요.");
      }
      setStep(step + 1); return;
    }
    const r = await fetch("/api/auth", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:mode, ...form }) });
    const raw = await r.text();
    let data: { error?: string; message?: string } = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    if (!r.ok) return setMessage(data.error || (r.status >= 500 ? "가입 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요." : "입력 내용을 다시 확인해 주세요."));
    if (mode === "recover") return setMessage(data.message);
    location.assign("/?app=1");
  }
  async function enterPreview() {
    setMessage("");
    const response = await fetch("/api/auth", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action:"preview" }),
    });
    if (!response.ok) return setMessage("미리보기 화면을 열지 못했어요.");
    location.assign("/?app=1");
  }
  return <main className="login-screen">
    <section className="login-card">
      <img className="brand-logo" src="/logo.svg" alt="오늘모먹지" />
      <h1>오늘모먹지</h1>
      <p>{mode === "login" ? "오늘모먹지" : mode === "signup" ? `회원가입 ${step}/3` : "계정 찾기"}</p>
      <form onSubmit={submit}>
        {(mode !== "signup" || step === 1) && <label>아이디<input autoComplete="username" value={form.username} onChange={e=>set("username",e.target.value)} required /></label>}
        {mode === "login" && <label>비밀번호<input type="password" autoComplete="current-password" value={form.password} onChange={e=>set("password",e.target.value)} required /></label>}
        {mode === "signup" && step === 2 && <><label>비밀번호<input type="password" autoComplete="new-password" value={form.password} onChange={e=>set("password",e.target.value)} required /></label><label>복구용 이메일<input type="email" autoComplete="email" value={form.email} onChange={e=>set("email",e.target.value)} required /></label></>}
        {mode === "signup" && step === 3 && <label>닉네임<input maxLength={20} value={form.nickname} onChange={e=>set("nickname",e.target.value)} required /></label>}
        {mode === "recover" && <label>복구용 이메일<input type="email" value={form.email} onChange={e=>set("email",e.target.value)} required /></label>}
        {message && <output>{message}</output>}
        <button className="login-primary">{mode === "signup" && step < 3 ? "다음" : mode === "login" ? "로그인" : mode === "signup" ? "시작하기" : "복구 안내 받기"}</button>
      </form>
      <div className="login-links">
        {mode !== "login" && <button onClick={()=>{setMode("login");setStep(1);setMessage("");}}>로그인</button>}
        {mode === "login" && <><button onClick={()=>{setMode("signup");setStep(1);}}>회원가입</button><button onClick={()=>setMode("recover")}>비밀번호를 잊었나요?</button></>}
      </div>
      {/* TODO: 정식 출시 전에 수정용 미리보기 진입 버튼 제거 */}
      <button type="button" className="preview-entry" onClick={enterPreview}>수정용 메인 화면 바로가기</button>
    </section>
  </main>;
}
