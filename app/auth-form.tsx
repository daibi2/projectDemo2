"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "操作失败，请重试。");
      setSubmitting(false);
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="brand-panel">
        <p className="eyebrow">PARKING OPERATIONS</p>
        <h1>泊位管家</h1>
        <p>让每一个空位、每一笔停车记录，都清晰可控。</p>
        <div className="brand-stats"><span>实时车位状态</span><span>自动计时收费</span><span>独立数据空间</span></div>
      </section>
      <section className="auth-card">
        <p className="eyebrow">{registering ? "GET STARTED" : "WELCOME BACK"}</p>
        <h2>{registering ? "创建您的账户" : "登录管理后台"}</h2>
        <p>{registering ? "注册后即可创建并管理您自己的停车场。" : "使用您的账户继续管理停车运营。"}</p>
        <form onSubmit={(event) => void submit(event)}>
          {registering && <label>姓名<input name="name" required maxLength={80} autoComplete="name" placeholder="您的姓名" /></label>}
          <label>邮箱<input name="email" required type="email" autoComplete="email" placeholder="name@example.com" /></label>
          <label>密码<input name="password" required minLength={8} type="password" autoComplete={registering ? "new-password" : "current-password"} placeholder="至少 8 位" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary full" disabled={submitting}>{submitting ? "处理中…" : registering ? "注册并开始使用" : "登录"}</button>
        </form>
        <p className="auth-switch">{registering ? "已有账户？" : "还没有账户？"} <Link href={registering ? "/login" : "/register"}>{registering ? "去登录" : "立即注册"}</Link></p>
      </section>
    </main>
  );
}
