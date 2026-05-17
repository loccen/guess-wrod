export default function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">AI 评分猜词</p>
        <h1 id="page-title">猜词游戏基础骨架</h1>
        <p className="summary">
          当前页面用于验证 Cloudflare Pages 静态前端已经可启动。游戏主流程、词库和评分接口会在后续任务中接入。
        </p>
        <a className="health-link" href="/api/health">
          查看健康检查
        </a>
      </section>
    </main>
  );
}
