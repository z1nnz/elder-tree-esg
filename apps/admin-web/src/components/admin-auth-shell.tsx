"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { WorkspaceAccessSummary } from "@elder-tree/contracts";
import { Leaf, ShieldCheck, UsersRound } from "lucide-react";
import { api } from "../lib/api";
import { adminAuth, firebaseConfigured } from "../lib/firebase";
import { OperationsDashboard } from "./operations-dashboard";
import { PartnerWorkspace } from "./partner-workspace";

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
  const [access, setAccess] = useState<WorkspaceAccessSummary | null>(null);

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
      setAccess(
        nextUser
          ? await withTimeout(api.workspaceAccess(), "Workspace access request timed out")
          : null,
      );
      setError(null);
    } catch {
      api.setAccessToken(null);
      setUser(null);
      setAccess(null);
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
        setAccess(null);
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
      setError("登入失敗，請確認帳號、密碼與工作區權限。");
      setReady(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <main className="auth-shell">正在確認工作區權限…</main>;
  }
  if (!firebaseConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>後台尚未設定 Firebase Web</h1>
          <p>
            請設定 NEXT_PUBLIC_FIREBASE_API_KEY、AUTH_DOMAIN、PROJECT_ID 與
            APP_ID。
          </p>
        </section>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-layout">
          <aside className="auth-story">
            <div className="auth-story-mark">
              <Leaf size={22} />
              同行成林
            </div>
            <div>
              <span>共創夥伴台</span>
              <h1>把一段好旅程，送到願意一起行動的人面前。</h1>
              <p>提案、審核與成果各自清楚，讓合作建立在安全和真實行動上。</p>
            </div>
            <ul>
              <li>
                <UsersRound size={17} /> 不消費也能完成
              </li>
              <li>
                <ShieldCheck size={17} /> 平台審核後才發布
              </li>
            </ul>
          </aside>
          <form className="auth-card" onSubmit={submit}>
            <span className="eyebrow">依帳號權限進入專屬工作區</span>
            <h2>登入共創工作區</h2>
            <p>平台營運人員與旅程共創夥伴使用同一個入口。</p>
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
            <button
              className="primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "正在登入…" : "進入工作區"}
            </button>
          </form>
        </section>
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
      {access?.role === "PLATFORM_ADMIN" ? <OperationsDashboard /> : null}
      {access && access.role !== "PLATFORM_ADMIN" && access.organizations.length > 0 ? (
        <PartnerWorkspace organizations={access.organizations} />
      ) : null}
      {access &&
      access.role !== "PLATFORM_ADMIN" &&
      access.organizations.length === 0 ? (
        <main className="auth-shell">
          <section className="auth-card">
            <h1>尚未開放工作區</h1>
            <p>這個帳號不是平台管理員，也尚未加入旅程共創夥伴組織。</p>
          </section>
        </main>
      ) : null}
    </>
  );
}
