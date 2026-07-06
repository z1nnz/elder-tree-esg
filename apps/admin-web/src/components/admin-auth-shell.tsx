"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { adminAuth, firebaseConfigured } from "../lib/firebase";
import { OperationsDashboard } from "./operations-dashboard";

export function AdminAuthShell() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(adminAuth(), async (nextUser) => {
      setUser(nextUser);
      api.setAccessToken(nextUser ? await nextUser.getIdToken() : null);
      setReady(true);
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(adminAuth(), email.trim(), password);
    } catch {
      setError("登入失敗，請確認帳號、密碼與平台管理員權限。");
    }
  }

  if (!ready) {
    return <main className="auth-shell">正在確認管理員身分…</main>;
  }
  if (!firebaseConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>後台尚未設定 Firebase Web</h1>
          <p>請設定 NEXT_PUBLIC_FIREBASE_API_KEY、AUTH_DOMAIN、PROJECT_ID 與 APP_ID。</p>
        </section>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="auth-shell">
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow">綠伴營運後台</span>
          <h1>平台管理員登入</h1>
          <p>Firebase 負責驗證身分，Neon 的 PLATFORM_ADMIN 角色決定管理權。</p>
          <label>
            電子郵件
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            密碼
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" type="submit">
            登入營運台
          </button>
        </form>
      </main>
    );
  }
  return (
    <>
      <button
        className="admin-signout"
        onClick={() => void signOut(adminAuth())}
      >
        登出 {user.email}
      </button>
      <OperationsDashboard />
    </>
  );
}
