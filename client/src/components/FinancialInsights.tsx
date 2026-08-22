import type { FinancialInsight } from '../types';

interface FinancialInsightsProps {
  insights?: FinancialInsight[];
}

export default function FinancialInsights({ insights = [] }: FinancialInsightsProps) {
  return (
    <section className="financial-insights" aria-labelledby="financial-insights-title">
      <div className="dashboard-section__heading">
        <div>
          <p className="dashboard-section__eyebrow">Automated analysis</p>
          <h2 id="financial-insights-title">Financial Insights</h2>
        </div>
      </div>
      <div className="financial-insights__grid">
        {insights.length ? insights.map((insight, index) => (
          <article key={`${insight.text}-${index}`} className={`financial-insight financial-insight--${insight.tone}`}>
            <span className="financial-insight__number">{index + 1}</span>
            <p>{insight.text}</p>
          </article>
        )) : (
          <div className="analytics-empty">Add expenses to receive personalised financial insights.</div>
        )}
      </div>
    </section>
  );
}
