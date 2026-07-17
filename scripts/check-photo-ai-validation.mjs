#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const apiBaseUrl = normalizeBaseUrl(
  process.env.API_URL ?? "http://127.0.0.1:4100/api/v1",
);
const verifierUrl = normalizeBaseUrl(
  process.env.AI_VERIFIER_URL ?? "http://127.0.0.1:4400",
);

const checks = [];

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function redact(value) {
  if (!value) return "";
  if (value.length <= 8) return "configured";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function addCheck(name, status, detail, nextStep = "") {
  checks.push({ name, status, detail, nextStep });
}

function requiredEnv(name, expectedValue = null) {
  const value = process.env[name];
  if (!value) {
    addCheck(name, "fail", "missing", `設定 ${name} 後再重跑。`);
    return;
  }
  if (expectedValue !== null && value !== expectedValue) {
    addCheck(
      name,
      "warn",
      `currently ${value}`,
      `實機驗收建議使用 ${name}=${expectedValue}。`,
    );
    return;
  }
  addCheck(name, "pass", expectedValue ?? "configured");
}

async function probeJson(name, url, validator, nextStep) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) {
      addCheck(
        name,
        "fail",
        `HTTP ${response.status}`,
        nextStep,
      );
      return null;
    }
    const payload = await response.json();
    const result = validator(payload);
    addCheck(name, result.status, result.detail, result.nextStep ?? "");
    return payload;
  } catch (error) {
    addCheck(
      name,
      "fail",
      error instanceof Error ? error.message : String(error),
      nextStep,
    );
    return null;
  }
}

function checkStorageRules() {
  const firebaseJsonExists = existsSync("firebase.json");
  const storageRulesExists = existsSync("storage.rules");
  if (!firebaseJsonExists || !storageRulesExists) {
    addCheck(
      "Firebase Storage rules files",
      "fail",
      "firebase.json or storage.rules missing",
      "確認 firebase.json 與 storage.rules 都在 repo 根目錄。",
    );
    return;
  }

  const firebaseJson = readFileSync("firebase.json", "utf8");
  const storageRules = readFileSync("storage.rules", "utf8");
  const pointsToRules = firebaseJson.includes('"storage"') &&
    firebaseJson.includes('"rules"') &&
    firebaseJson.includes("storage.rules");
  const evidencePathLocked = storageRules.includes("evidence/{uid}") &&
    storageRules.includes("request.auth.uid == uid");

  if (!pointsToRules || !evidencePathLocked) {
    addCheck(
      "Firebase Storage rules files",
      "warn",
      "files exist but expected evidence rule was not detected",
      "檢查 storage.rules 是否仍限制 evidence/{uid}/ 只能本人寫入。",
    );
    return;
  }

  addCheck(
    "Firebase Storage rules files",
    "pass",
    "storage.rules configured for private evidence writes",
  );
}

function printReport() {
  const symbol = {
    pass: "✅",
    warn: "⚠️",
    fail: "❌",
  };
  const failed = checks.filter((check) => check.status === "fail");
  const warned = checks.filter((check) => check.status === "warn");

  console.log("\nPhoto AI real-device validation readiness\n");
  for (const check of checks) {
    console.log(`${symbol[check.status]} ${check.name}`);
    console.log(`   ${check.detail}`);
    if (check.nextStep) console.log(`   下一步：${check.nextStep}`);
  }

  console.log("\nSummary");
  if (failed.length === 0 && warned.length === 0) {
    console.log("✅ 可以開始實機拍照驗收。");
    process.exitCode = 0;
    return;
  }
  if (failed.length === 0) {
    console.log("⚠️ 可以做部分驗收，但建議先處理 warning。");
    process.exitCode = 0;
    return;
  }
  console.log("❌ 還不能做完整照片 AI 實機驗收。");
  process.exitCode = 1;
}

requiredEnv("PHOTO_EVIDENCE_ENABLED", "true");
requiredEnv("PHOTO_VERIFICATION_ENABLED", "true");
requiredEnv("FIREBASE_STORAGE_BUCKET");
requiredEnv("AI_VERIFIER_URL");

if (process.env.GEMINI_API_KEY) {
  addCheck("GEMINI_API_KEY", "pass", `configured as ${redact(process.env.GEMINI_API_KEY)}`);
} else {
  addCheck(
    "GEMINI_API_KEY",
    "warn",
    "missing in this shell",
    "若要驗收 Gemini 圖片判斷，請在啟動 AI verifier 的 shell 設定 GEMINI_API_KEY。",
  );
}

checkStorageRules();

await probeJson(
  "API health",
  `${apiBaseUrl}/health`,
  (payload) => {
    const status = payload?.data?.status;
    return status === "ok"
      ? { status: "pass", detail: `${apiBaseUrl}/health is ok` }
      : {
          status: "warn",
          detail: `unexpected response: ${JSON.stringify(payload).slice(0, 160)}`,
        };
  },
  `啟動 API：npm run dev:api:neon，並確認 API_URL=${apiBaseUrl}`,
);

await probeJson(
  "AI verifier health",
  `${verifierUrl}/health`,
  (payload) => {
    if (payload?.status !== "ok") {
      return {
        status: "warn",
        detail: `unexpected response: ${JSON.stringify(payload).slice(0, 160)}`,
      };
    }
    if (payload.mode !== "gemini") {
      return {
        status: "warn",
        detail: `verifier is running in ${payload.mode} mode with ${payload.model}`,
        nextStep: "若要驗收真正 Gemini，請用 GEMINI_API_KEY 啟動 npm run dev:ai。",
      };
    }
    return {
      status: "pass",
      detail: `verifier is running in gemini mode with ${payload.model}`,
    };
  },
  `啟動 verifier：GEMINI_API_KEY=... npm run dev:ai，並確認 AI_VERIFIER_URL=${verifierUrl}`,
);

printReport();
