import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

// ===== Generic fetch hook =====
function useFetch<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, deps);

  return { data, loading, error };
}

// ===== Portfolio Summary =====
export function usePortfolioSummary(customerId = 'CUST0001') {
  return useFetch(() => api.getPortfolioSummary(customerId), [customerId]);
}

// ===== Holding Signals =====
export function useHoldingSignals(customerId = 'CUST0001', limit = 10) {
  return useFetch(() => api.getHoldingSignals(customerId, limit), [customerId, limit]);
}

// ===== Unexpected Signals =====
export function useUnexpectedSignals(limit = 4) {
  return useFetch(() => api.getUnexpectedSignals(limit), [limit]);
}

// ===== Market Events =====
export function useMarketEvents(limit = 5) {
  return useFetch(() => api.getMarketEvents(limit), [limit]);
}

// ===== Schedules =====
export function useSchedules(limit = 10) {
  return useFetch(() => api.getSchedules(limit), [limit]);
}

// ===== Market Overview =====
export function useMarketOverview(segment?: string) {
  return useFetch(() => api.getMarketOverview(segment), [segment]);
}

// ===== Customer Alerts =====
export function useCustomerAlerts(customerId?: string, priority?: string) {
  return useFetch(() => api.getCustomerAlerts(customerId, priority), [customerId, priority]);
}

// ===== Situation Summary =====
export function useSituationSummary(customerId = 'CUST0010') {
  return useFetch(() => api.getSituationSummary(customerId), [customerId]);
}

// ===== Top Investors =====
export function useTopInvestors(limit = 4) {
  return useFetch(() => api.getTopInvestors(limit), [limit]);
}

// ===== Chat =====
export function useChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const send = async (question: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await api.chat(question, conversationId);
      setConversationId(res.conversation_id);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `오류: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return { messages, loading, send, conversationId };
}
