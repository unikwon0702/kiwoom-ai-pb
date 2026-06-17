/**
 * Multi-Session Chat Persistence
 * 
 * - window.__AIPB_SID: 현재 세션 ID (휘발성 → F5 새로고침 시 새 세션)
 * - window.__AIPB_CID: 현재 고객 ID (고객 전환 감지)
 * - localStorage: 세션 목록 + 메시지 영구 저장 (고객별 분리)
 */

declare global {
  interface Window {
    __AIPB_SID?: string | null;
    __AIPB_CID?: string | null;
  }
}

const SL_PREFIX = "aipb_slist_";
const SD_PREFIX = "aipb_sdata_";
const MAX_SESSIONS = 30;

export interface SessionEntry {
  id: string;
  title: string;
  ts: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getCurrentSessionId(): string | null {
  return window.__AIPB_SID || null;
}

export function startNewSession(): string {
  const id = generateId();
  window.__AIPB_SID = id;
  return id;
}

export function getSessionList(customerId: string): SessionEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SL_PREFIX + customerId) || "[]");
  } catch {
    return [];
  }
}

export function loadSessionMessages(sessionId: string): any[] {
  try {
    return JSON.parse(localStorage.getItem(SD_PREFIX + sessionId) || "[]");
  } catch {
    return [];
  }
}

export function saveSessionMessages(sessionId: string, messages: any[]): void {
  try {
    // 대용량 필드 제거하여 localStorage 용량 절약 (structured, card_data, tableData, sql)
    const light = messages.map(m => {
      if (m.role === "user") return m;
      // bot 메시지: 렌더링에 필수인 필드만 보존
      const { structured, card_data, tableData, sql, ...rest } = m;
      return {
        ...rest,
        // card_type만 보존 (card_data 없이는 렌더링 안 됨 → 히스토리에서는 텍스트만 표시)
        card_type: undefined,
      };
    });
    const json = JSON.stringify(light);
    // 500KB 초과 시 추가 경량화 (followUps, description 제거)
    if (json.length > 500_000) {
      const ultraLight = light.map((m: any) =>
        m.role === "bot" ? { role: m.role, text: m.text, disclaimer: m.disclaimer } : m
      );
      localStorage.setItem(SD_PREFIX + sessionId, JSON.stringify(ultraLight));
    } else {
      localStorage.setItem(SD_PREFIX + sessionId, json);
    }
  } catch {
    // quota exceeded: 오래된 세션 데이터 정리 후 재시도
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(SD_PREFIX));
      if (keys.length > 5) {
        // 가장 오래된 것부터 3개 삭제
        keys.slice(0, 3).forEach(k => localStorage.removeItem(k));
        const light = messages.map(m => {
          if (m.role === "user") return m;
          const { structured, card_data, tableData, sql, ...rest } = m;
          return { ...rest, card_type: undefined };
        });
        localStorage.setItem(SD_PREFIX + sessionId, JSON.stringify(light));
      }
    } catch { /* 최종 실패 — 무시 */ }
  }
}

export function addSession(customerId: string, title: string, sessionId: string): void {
  const list = getSessionList(customerId);
  const existing = list.find(s => s.id === sessionId);
  if (existing) {
    existing.title = title;
    existing.ts = Date.now();
  } else {
    list.unshift({ id: sessionId, title, ts: Date.now() });
  }
  while (list.length > MAX_SESSIONS) {
    const removed = list.pop();
    if (removed) {
      try { localStorage.removeItem(SD_PREFIX + removed.id); } catch {}
    }
  }
  try {
    localStorage.setItem(SL_PREFIX + customerId, JSON.stringify(list));
  } catch {}
}

export function initSession(customerId: string): { sid: string; messages: any[] } {
  const sid = getCurrentSessionId();
  if (sid) {
    const msgs = loadSessionMessages(sid);
    if (msgs.length > 0) return { sid, messages: msgs };
  }
  const newSid = startNewSession();
  return { sid: newSid, messages: [] };
}

export function detectCustomerSwitch(customerId: string): boolean {
  const prev = window.__AIPB_CID;
  window.__AIPB_CID = customerId;
  if (prev && prev !== customerId) {
    startNewSession();
    return true;
  }
  return false;
}

export function clearAllSessions(customerId: string): void {
  const list = getSessionList(customerId);
  list.forEach(s => {
    try { localStorage.removeItem(SD_PREFIX + s.id); } catch {}
  });
  try { localStorage.removeItem(SL_PREFIX + customerId); } catch {}
}
