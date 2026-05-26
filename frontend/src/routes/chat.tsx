import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, X, Info, Send, Menu, Mic } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";

type ChatSearch = { view?: "asset-analysis" };

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    view: search.view === "asset-analysis" ? "asset-analysis" : undefined,
  }),
});

type Msg =
  | { role: "user"; text: string }
  | { role: "bot"; kind: "text"; text: string }
  | { role: "bot"; kind: "diagnosis" }
  | { role: "bot"; kind: "asset-analysis" }
  | { role: "bot"; kind: "followup"; suggestions: string[] };

const HISTORY_KEY = "aipb_chat_questions";

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function ChatPage() {
  const { view } = Route.useSearch();
  const [messages, setMessages] = useState<Msg[]>(() =>
    view === "asset-analysis"
      ? [
          { role: "bot", kind: "text", text: "김키움님의 어제 자산을 분석해봤어요." },
          { role: "bot", kind: "asset-analysis" },
        ]
      : [],
  );
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendQuestion = async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    // 히스토리 저장
    setHistory((prev) => {
      const next = [text, ...prev.filter((q) => q !== text)].slice(0, 30);
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    try {
      const res = await api.chat(text, conversationId);
      setConversationId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: "bot", kind: "text", text: res.answer },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", kind: "text", text: `죄송해요, 응답 중 오류가 발생했어요: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const userText = input.trim();
    if (!userText) return;
    setInput("");
    sendQuestion(userText);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#E9EFFE" }}>
      <div
        className="max-w-[480px] mx-auto min-h-screen flex flex-col"
        style={{ backgroundColor: "#E9EFFE" }}
      >
        <header
          className="sticky top-0 z-10 backdrop-blur-md"
          style={{ backgroundColor: "#606CF2" }}
        >
          <div className="flex items-center justify-between px-3 h-14">
            <Link to="/" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white">
              <ChevronLeft className="size-5" />
            </Link>
            <span className="text-[16px] font-semibold tracking-tight text-white">AI PB 챗봇</span>
            <div className="flex items-center">
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="질문 히스토리"
                className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"
              >
                <Menu className="size-5" />
              </button>
              <Link to="/" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white">
                <X className="size-5" />
              </Link>
            </div>
          </div>
        </header>

        <HistoryPanel
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          history={history}
          onSelect={(q) => {
            setMenuOpen(false);
            sendQuestion(q);
          }}
          onClear={() => {
            setHistory([]);
            try {
              window.localStorage.removeItem(HISTORY_KEY);
            } catch {
              // ignore
            }
          }}
        />


        <main className="flex-1 px-5 pt-6 pb-4">
          <p className="text-[16px] leading-[1.55] text-foreground">
            AI 자산관리챗봇 <span className="font-bold text-[#606CF2]">AI PB</span>입니다.
            <br />
            무엇을 알려드릴까요?
          </p>
          <button className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground/80">
            AI PB 서비스 이용 유의사항
            <Info className="size-3.5" />
          </button>

          {!hasMessages && (
            <div className="mt-6">
              <p className="text-[12.5px] text-muted-foreground/80 mb-2">이런 걸 물어볼 수 있어요</p>
              <div className="flex flex-wrap gap-2">
                {["종목 진단 해줘", "내 포트폴리오 분석해줘", "오늘 시장 이슈 알려줘", "지금 사도 될까?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => sendQuestion(q)}
                    className="text-[13px] px-3.5 py-2 rounded-full bg-white border text-foreground hover:bg-white/80 transition-colors"
                    style={{ borderColor: "#C9D3F5" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="mt-6 space-y-3">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div
                      className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-[1.5] text-white"
                      style={{ backgroundColor: "#606CF2" }}
                    >
                      {m.text}
                    </div>
                  </div>
                ) : m.kind === "text" ? (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[90%] text-[14px] leading-[1.55] text-foreground">{m.text}</div>
                  </div>
                ) : m.kind === "asset-analysis" ? (
                  <AssetAnalysisCard key={i} />
                ) : m.kind === "followup" ? (
                  <div key={i} className="flex flex-wrap gap-2 pt-1">
                    {m.suggestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendQuestion(q)}
                        className="text-[13px] px-3.5 py-2 rounded-full bg-white border text-foreground hover:bg-white/80 transition-colors"
                        style={{ borderColor: "#C9D3F5" }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                ) : (
                  <DiagnosisCard key={i} />
                ),
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] text-[14px] leading-[1.55] text-muted-foreground animate-pulse">
                    💭 답변 생성 중...
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </main>

        <div className="sticky bottom-0 px-4 pb-5 pt-3" style={{ backgroundColor: "#E9EFFE" }}>
          <div className="rounded-full p-px bg-gradient-to-r from-[#C9B5FF] via-[#A8C5FF] to-[#FFB8D8]">
            <div className="flex items-center gap-2 rounded-full bg-white pl-2 pr-1.5 py-1.5">
              <button
                type="button"
                aria-label="음성 입력"
                className="size-9 rounded-full flex items-center justify-center text-foreground/70 hover:bg-muted"
              >
                <Mic className="size-[18px]" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder="AI PB에게 물어보세요"
                className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/70 outline-none py-2"
              />

              <button
                onClick={handleSend}
                aria-label="전송"
                className="size-9 rounded-full flex items-center justify-center text-white bg-gradient-to-r from-[#C9B5FF] via-[#A8C5FF] to-[#FFB8D8]"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiagnosisCard() {
  return (
    <div className="rounded-2xl bg-white border shadow-sm p-4 space-y-4" style={{ borderColor: "#C9D3F5" }}>
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "#E4EAFB" }}>
        <span className="text-[18px]">📈</span>
        <h3 className="text-[15px] font-bold text-foreground">삼성전자 주식 진단</h3>
      </div>

      <Section icon="🎯" title="종합 결론">
        <p className="text-[13px] leading-[1.6] text-foreground/85">
          미국 AI 서버 투자 확대 기대와 외국인 매수세가 맞물리며 주가 상승 흐름이 강화되고 있어요.
        </p>
      </Section>

      <Section icon="💪" title="펀더멘털 진단">
        <Oneline text="AI 수요 증가로 실적 개선 기대가 높아지고 있어요" />
        <Bullets
          items={[
            { k: "영업이익률", v: "개선 추세", note: "메모리 가격 상승 영향" },
            { k: "순이익률", v: "상승 기조", note: "고부가 제품 확대 영향" },
            { k: "매출성장률", v: "회복 국면", note: "AI 서버 수요 증가 영향" },
          ]}
        />
      </Section>

      <Section icon="📊" title="기술적 진단">
        <Oneline text="상승 추세가 형성되며 모멘텀이 강화되고 있어요" />
        <Bullets
          items={[
            { k: "추세선 기울기", v: "우상향", note: "상승 추세 지속" },
            { k: "신고가/신저가", v: "고점 갱신 시도", note: "상승 압력 확대" },
            { k: "RSI", v: "중립~강세", note: "추가 상승 여지" },
          ]}
        />
      </Section>

      <Section icon="💰" title="수급 진단">
        <Oneline text="외국인 순매수가 4일 연속 증가했어요" />
        <Bullets items={[{ k: "외국인", v: "순매수 4일 연속 증가", note: "매수세 유입 확대" }]} />
      </Section>

      <Section icon="🗃️" title="이벤트 시황 진단">
        <Oneline text="미국 정부의 AI 서버 투자 확대 기대로 삼성전자 실적 개선 기대가 커지고 있어요" />
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[14px]">{icon}</span>
        <h4 className="text-[13.5px] font-semibold text-foreground">{title}</h4>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Oneline({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-[12.5px] leading-[1.5] font-medium"
      style={{ backgroundColor: "#EEF0FF", color: "#606CF2" }}
    >
      💬 {text}
    </div>
  );
}

function Bullets({ items }: { items: { k: string; v: string; note: string }[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.k} className="text-[12.5px] leading-[1.5] text-foreground/85">
          <span className="font-semibold text-foreground">{it.k}: </span>
          <span>{it.v}</span>
          <span className="text-muted-foreground"> ({it.note})</span>
        </li>
      ))}
    </ul>
  );
}

function AssetAnalysisCard() {
  return (
    <div className="rounded-2xl bg-white border shadow-sm p-4 space-y-4" style={{ borderColor: "#C9D3F5" }}>
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "#E4EAFB" }}>
        <span className="text-[18px]">💼</span>
        <h3 className="text-[15px] font-bold text-foreground">어제 자산 분석 리포트</h3>
      </div>

      <Section icon="📈" title="전체 수익률">
        <Oneline text="어제 대비 +2.8% 상승하며 강한 회복세를 보였어요" />
        <Bullets
          items={[
            { k: "총 평가금액", v: "1억 2,450만원", note: "전일 대비 +340만원" },
            { k: "일간 수익률", v: "+2.8%", note: "코스피 +1.2% 대비 우수" },
            { k: "누적 수익률", v: "+12.4%", note: "연초 대비" },
          ]}
        />
      </Section>

      <Section icon="🏆" title="수익 기여 종목">
        <Oneline text="삼성전자가 수익 상승에 가장 크게 기여했어요" />
        <Bullets
          items={[
            { k: "삼성전자", v: "+4.2%", note: "AI 서버 수요 기대" },
            { k: "SK하이닉스", v: "+3.1%", note: "HBM 매출 확대" },
            { k: "현대차", v: "+1.8%", note: "북미 판매 호조" },
          ]}
        />
      </Section>

      <Section icon="⚠️" title="주의 종목">
        <Oneline text="일부 종목은 단기 조정 흐름이 나타나고 있어요" />
        <Bullets
          items={[
            { k: "카카오", v: "-1.2%", note: "규제 이슈 영향" },
            { k: "LG화학", v: "-0.8%", note: "2차전지 수요 둔화" },
          ]}
        />
      </Section>

      <Section icon="🧭" title="자산 배분 진단">
        <Oneline text="국내 주식 비중이 다소 높아요. 분산 투자를 고려해보세요" />
        <Bullets
          items={[
            { k: "국내 주식", v: "68%", note: "권장 50~60%" },
            { k: "해외 주식", v: "18%", note: "권장 20~30%" },
            { k: "채권/현금", v: "14%", note: "권장 15~20%" },
          ]}
        />
      </Section>
    </div>
  );
}

function HistoryPanel({
  open,
  onClose,
  history,
  onSelect,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  history: string[];
  onSelect: (q: string) => void;
  onClear: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <aside
        className="absolute right-0 top-0 h-full w-[82%] max-w-[360px] bg-white shadow-xl flex flex-col"
        role="dialog"
        aria-label="질문 히스토리"
      >
        <div
          className="flex items-center justify-between px-4 h-14 border-b"
          style={{ borderColor: "#E4EAFB" }}
        >
          <h2 className="text-[15px] font-semibold text-foreground">최근 질문</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="size-9 flex items-center justify-center rounded-full hover:bg-black/5 text-foreground/80"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {history.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-muted-foreground text-center">
              아직 질문 내역이 없어요.
            </p>
          ) : (
            <ul className="space-y-1">
              {history.map((q, i) => (
                <li key={`${q}-${i}`}>
                  <button
                    onClick={() => onSelect(q)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-[13.5px] leading-[1.5] text-foreground hover:bg-[#F2F5FE] transition-colors"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {history.length > 0 && (
          <div className="px-4 py-3 border-t" style={{ borderColor: "#E4EAFB" }}>
            <button
              onClick={onClear}
              className="w-full text-[13px] text-muted-foreground hover:text-foreground py-2"
            >
              전체 기록 삭제
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
