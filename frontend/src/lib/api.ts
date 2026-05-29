/**
 * Backend API 통신 래퍼.
 * Databricks App 내부에서 동일 Origin이므로 CORS 불필요.
 */

const BASE = '/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new ApiError(await res.text(), res.status);
  }
  return res.json();
}

// ===== Data API =====

export const api = {
  getDashboard: () => request<any>('/dashboard'),

  getPortfolioSummary: (customerId = 'CUST0001') =>
    request<any>(`/portfolio-summary?customer_id=${customerId}`),

  getHoldingSignals: (customerId = 'CUST0001', limit = 10) =>
    request<{ holdings: any[] }>(
      `/holding-signals?customer_id=${customerId}&limit=${limit}`
    ),

  getUnexpectedSignals: (limit = 4) =>
    request<{ signals: any[] }>(`/unexpected-signals?limit=${limit}`),

  getMarketEvents: (limit = 5) =>
    request<{ events: any[] }>(`/market-events?limit=${limit}`),

  getMarketOverview: (segment?: string) => {
    const q = segment ? `?segment=${segment}` : '';
    return request<{ markets: any[] }>(`/market-overview${q}`);
  },

  getSchedules: (limit = 10) =>
    request<{ schedules: any[] }>(`/schedules?limit=${limit}`),

  getCustomerAlerts: (customerId?: string, priority?: string) => {
    const params = new URLSearchParams();
    if (customerId) params.set('customer_id', customerId);
    if (priority) params.set('priority', priority);
    const q = params.toString() ? `?${params}` : '';
    return request<{ alerts: any[] }>(`/customer-alerts${q}`);
  },

  getSituationSummary: (customerId = 'CUST0010') =>
    request<{
      customer_id: string;
      customer_name: string;
      as_of_date: string;
      investment_change: { summary: string };
      market_context: { summary: string };
      upcoming_schedule: { summary: string };
    }>(`/situation-summary?customer_id=${customerId}`),

  getTopInvestors: (limit = 4) =>
    request<{ investors: any[] }>(`/top-investor?limit=${limit}`),

      getEventDetail: (eventId: string) =>
    request<any>(`/event-detail?event_id=${eventId}`),

  getCustomerInterests: (customerId: string) =>
    request<{ interests: { asset_name: string; asset_type: string; asset_subtype: string; interest_type: string; display_rank: number; already_held_yn: string }[] }>(
      `/customer-interests?customer_id=${customerId}`
    ),

  // ===== Chat API =====
  chat: (question: string, conversationId?: string) =>
    request<{
      status: string;
      answer: string;
      sql?: string;
      conversation_id: string;
    }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ question, conversation_id: conversationId }),
    }),
};
