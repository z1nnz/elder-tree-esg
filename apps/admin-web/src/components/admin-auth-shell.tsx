"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { adminAuth, firebaseConfigured } from "../lib/firebase";
import { OperationsDashboard } from "./operations-dashboard";

const AUTH_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error(message)),
      AUTH_TIMEOUT_MS,
    );

    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function AdminAuthShell() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const establishSession = useCallback(async (nextUser: User | null) => {
    setReady(false);
    try {
      const accessToken = nextUser
        ? await withTimeout(
            nextUser.getIdToken(),
            "Firebase access token request timed out",
          )
        : null;
      api.setAccessToken(accessToken);
      setUser(nextUser);
      setError(null);
    } catch {
      api.setAccessToken(null);
      setUser(null);
      setError("登入憑證讀取逾時，請重新登入後再試一次。");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setReady(true);
      return;
    }

    let observerResponded = false;
    const watchdog = window.setTimeout(() => {
      if (observerResponded) return;
      api.setAccessToken(null);
      setUser(null);
      setError("Firebase 登入狀態讀取逾時，請重新登入。");
      setReady(true);
    }, AUTH_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(
      adminAuth(),
      (nextUser) => {
        observerResponded = true;
        window.clearTimeout(watchdog);
        void establishSession(nextUser);
      },
      () => {
        observerResponded = true;
        window.clearTimeout(watchdog);
        api.setAccessToken(null);
        setUser(null);
        setError("無法讀取 Firebase 登入狀態，請重新登入。");
        setReady(true);
      },
    );

    return () => {
      window.clearTimeout(watchdog);
      unsubscribe();
    };
  }, [establishSession]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const credential = await signInWithEmailAndPassword(
        adminAuth(),
        email.trim(),
        password,
      );
      await establishSession(credential.user);
    } catch {
      setError("登入失敗，請確認帳號、密碼與平台管理員權限。");
      setReady(true);
    } finally {
      setSubmitting(false);
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
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "正在登入…" : "登入營運台"}
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
