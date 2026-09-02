import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {padded ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div style={{ minWidth: 0 }}>
        <h2 className="section-title">{title}</h2>
        {subtitle && (
          <p className="muted text-xs" style={{ marginTop: 2 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Kpi({
  label,
  value,
  foot,
  accent,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <section className="card">
      <div className="kpi">
        {accent && <span className="kpi-accent" style={{ background: accent }} />}
        <span className="kpi-label">{label}</span>
        {loading ? (
          <div className="skel" style={{ height: 26, width: '55%', margin: '2px 0' }} />
        ) : (
          <span className="kpi-value">{value}</span>
        )}
        {foot && !loading && <span className="kpi-foot">{foot}</span>}
      </div>
    </section>
  );
}

export function Avatar({ name, src, large = false }: { name?: string; src?: string | null; large?: boolean }) {
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return (
    <span className={`avatar${large ? ' avatar-lg' : ''}`}>
      {src ? <img src={src} alt="" loading="lazy" /> : initials || '?'}
    </span>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          className={`tab${tab.value === value ? ' active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="count">{tab.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="dl">
      {items.map(([term, description]) => (
        <div key={term} style={{ display: 'contents' }}>
          <dt>{term}</dt>
          <dd>{description}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}
