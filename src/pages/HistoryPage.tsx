import { useEffect, useState } from "react";
import { apiClient, type GameHistoryPageData } from "../app/apiClient";
import { ensureSession, getErrorMessage, toHistoryListItems } from "../app/frontendFlow";
import { IconBadge } from "../components/IconBadge";

type HistoryPageProps = {
  navigate: (to: string, options?: { replace?: boolean }) => void;
};

const PAGE_SIZE = 10;

type ScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: GameHistoryPageData };

export function HistoryPage({ navigate }: HistoryPageProps) {
  const [page, setPage] = useState(1);
  const [screenState, setScreenState] = useState<ScreenState>({ status: "loading" });
  const [pendingGameId, setPendingGameId] = useState<string | null>(null);
  const [clearPending, setClearPending] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      setScreenState({ status: "loading" });
      try {
        const token = await ensureSession().then((restored) => restored.token);
        const data = await apiClient.listGameHistory(token, { page, pageSize: PAGE_SIZE });
        if (!active) {
          return;
        }
        setScreenState({ status: "ready", data });
      } catch (error) {
        if (!active) {
          return;
        }
        setScreenState({ status: "error", message: getErrorMessage(error) });
      }
    })();

    return () => {
      active = false;
    };
  }, [page]);

  async function reloadCurrentPage(nextPage = page) {
    const token = await ensureSession().then((restored) => restored.token);
    const data = await apiClient.listGameHistory(token, { page: nextPage, pageSize: PAGE_SIZE });
    setPage(data.page);
    setScreenState({ status: "ready", data });
  }

  async function handleDelete(gameId: string) {
    setPendingGameId(gameId);
    try {
      const token = await ensureSession().then((restored) => restored.token);
      await apiClient.deleteHistoryGame(token, gameId);
      if (screenState.status === "ready" && screenState.data.items.length === 1 && page > 1) {
        await reloadCurrentPage(page - 1);
      } else {
        await reloadCurrentPage();
      }
    } catch (error) {
      setScreenState({ status: "error", message: getErrorMessage(error) });
    } finally {
      setPendingGameId(null);
    }
  }

  async function handleClearAll() {
    setClearPending(true);
    try {
      const token = await ensureSession().then((restored) => restored.token);
      await apiClient.clearGameHistory(token);
      await reloadCurrentPage(1);
    } catch (error) {
      setScreenState({ status: "error", message: getErrorMessage(error) });
    } finally {
      setClearPending(false);
    }
  }

  const historyItems = screenState.status === "ready" ? toHistoryListItems(screenState.data.items) : [];

  return (
    <main className="phone-page history-page">
      <section className="card history-card">
        <div className="section-title">
          <IconBadge label="◎" />
          <h1>历史记录</h1>
        </div>
        <p className="history-summary">查看自己所有已结束对局，支持分页和手动删除。</p>

        {screenState.status === "loading" && <p className="history-helper">正在读取历史记录</p>}
        {screenState.status === "error" && <p className="inline-error">{screenState.message}</p>}

        {screenState.status === "ready" && historyItems.length === 0 && (
          <div className="recent-row recent-row--placeholder">
            <span>还没有已结束对局</span>
            <em className="status-pill status-pill--muted">空</em>
          </div>
        )}

        {screenState.status === "ready" && historyItems.length > 0 && (
          <>
            <div className="history-toolbar">
              <span className="history-total">共 {screenState.data.total} 条</span>
              <button type="button" className="danger-link" onClick={handleClearAll} disabled={clearPending}>
                {clearPending ? "正在清空" : "清空全部"}
              </button>
            </div>
            <div className="recent-list">
              {historyItems.map((item) => (
                <div className="history-record" key={item.gameId}>
                  <button type="button" className="recent-row recent-row--button" onClick={() => navigate(item.resultHref)}>
                    <span>{item.title}</span>
                    <em className={`status-pill status-pill--${item.statusTone}`}>{item.statusText}</em>
                    <b aria-hidden="true">›</b>
                  </button>
                  <div className="history-record-footer">
                    <span className="recent-helper">{item.meta}</span>
                    <button
                      type="button"
                      className="danger-link"
                      onClick={() => handleDelete(item.gameId)}
                      disabled={pendingGameId === item.gameId}
                    >
                      {pendingGameId === item.gameId ? "删除中" : "删除"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="history-pagination">
              <button type="button" className="secondary-pill secondary-pill--button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={screenState.data.page <= 1}>
                上一页
              </button>
              <span className="history-page-indicator">
                第 {screenState.data.page} 页 / {Math.max(1, Math.ceil(screenState.data.total / screenState.data.page_size))} 页
              </span>
              <button
                type="button"
                className="secondary-pill secondary-pill--button"
                onClick={() => setPage((value) => value + 1)}
                disabled={!screenState.data.has_more}
              >
                下一页
              </button>
            </div>
          </>
        )}
      </section>

      <button type="button" className="home-link home-link--button" onClick={() => navigate("/")}>
        ⌂ 返回首页 ›
      </button>
    </main>
  );
}
