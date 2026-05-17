import { IconBadge } from "../components/IconBadge";

export function RulesPage() {
  return (
    <main className="phone-page rules-page">
      <header className="rules-header">
        <a href="/" data-ui-id="back-link">‹ 返回</a>
        <span>玩法与隐私</span>
      </header>
      <section className="rules-hero">
        <h1 data-ui-id="rules-heading">怎么玩？</h1>
        <p>输入一个词，看它离答案有多近。</p>
      </section>

      <section className="card rules-card" data-ui-id="rules-card">
        <div className="section-title">
          <IconBadge label="□" />
          <h2>玩法规则</h2>
        </div>
        <ol className="rules-list">
          <li><span>1</span><strong>每局一个隐藏答案</strong><p>系统随机选择一个词作为答案，直到你猜中或放弃。</p></li>
          <li><span>2</span><strong>输入猜词后只显示接近百分比</strong><p>AI 只告诉你猜词与答案的接近程度（百分比）。</p></li>
          <li><span>3</span><strong>100% 代表猜中答案或别名</strong><p>达到 100% 即表示你猜对了答案或其别名。</p></li>
          <li><span>4</span><strong>最多 100 次有效猜词，24 小时内完成</strong><p>任一条件达成即本局结束。</p></li>
        </ol>
      </section>

      <section className="card ai-card">
        <div className="section-title">
          <IconBadge label="☷" />
          <h2>AI 评分说明</h2>
        </div>
        <p>系统会根据你的输入判断语义接近程度，并返回百分比。</p>
        <p>不会展示 AI 解释。</p>
      </section>

      <section className="card privacy-card" data-ui-id="privacy-card">
        <div className="section-title">
          <IconBadge label="♙" />
          <h2>隐私说明</h2>
        </div>
        <ul>
          <li>匿名游玩，不需要登录</li>
          <li>不收集姓名、手机号或微信信息</li>
          <li>猜词内容用于评分与质量分析</li>
        </ul>
      </section>

      <section className="card exception-card">
        <div className="section-title">
          <IconBadge label="!" />
          <h2>异常不计次</h2>
        </div>
        <div className="tag-row">
          <span>重复猜词</span>
          <span>非法输入</span>
          <span>敏感词</span>
          <span>限流</span>
          <span>AI 超时</span>
        </div>
      </section>

      <a className="primary-button" data-ui-id="confirm-button" href="/">
        <span aria-hidden="true">✓</span>
        知道了
      </a>
    </main>
  );
}
