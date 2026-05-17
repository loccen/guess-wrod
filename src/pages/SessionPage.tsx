import { useEffect, useState } from "react";
import { ensureSession, getErrorMessage } from "../app/frontendFlow";
import { buildGamePath } from "../routes/routeState";
import { IconBadge } from "../components/IconBadge";

type SessionPageProps = {
  navigate: (to: string, options?: { replace?: boolean }) => void;
};

export function SessionPage({ navigate }: SessionPageProps) {
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const restored = await ensureSession();
        if (!active) {
          return;
        }

        if (restored.session.active_game_id) {
          navigate(buildGamePath(restored.session.active_game_id), { replace: true });
          return;
        }

        navigate("/", { replace: true });
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorText(getErrorMessage(error));
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="phone-page session-page">
      <section className="session-hero">
        <h1 data-ui-id="app-title">猜不到的词</h1>
        <p>猜一个词，看它离答案有多近</p>
      </section>
      <section className="card restore-card" data-ui-id="restore-card">
        <div className="loader-orbit" aria-hidden="true" />
        <h2>正在进入游戏</h2>
        <p>{errorText ? "会话恢复失败" : "恢复上局中"}</p>
        <div className="restore-line">
          <IconBadge label="♙" />
          <div>
            <strong>匿名会话</strong>
            <span>不需要登录</span>
          </div>
        </div>
        <p className="security-note" data-ui-id="security-note">如需验证，将自动完成安全校验</p>
        <p className="muted-note">不会收集姓名、手机号或微信信息</p>
        {errorText && (
          <>
            <p className="inline-error">{errorText}</p>
            <button className="secondary-action" type="button" onClick={() => window.location.reload()}>
              重试
            </button>
          </>
        )}
      </section>
    </main>
  );
}
