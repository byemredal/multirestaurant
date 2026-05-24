import { Icon, type IconName } from '@/lib/icons';
import SectionCard from './SectionCard';

export type RoadmapEntry = {
  phase: string;
  title: string;
  description: string;
  eta: string;
};

export type ComingSoonProps = {
  /** Small uppercase label above the title, e.g. "AI Center". */
  eyebrow: string;
  icon: IconName;
  title: string;
  description: string;
  plannedFeatures: string[];
  integrations: string[];
  roadmap: RoadmapEntry[];
  /** Disabled visual preview shown at the bottom of the page. */
  preview?: 'chart' | 'table' | 'none';
};

/**
 * Polished placeholder for unimplemented sections (AI Center, CRM, etc.).
 * Communicates intent and roadmap instead of showing a blank route.
 */
export default function ComingSoonPage({
  eyebrow,
  icon,
  title,
  description,
  plannedFeatures,
  integrations,
  roadmap,
  preview = 'chart',
}: ComingSoonProps) {
  const HeroIcon = Icon[icon];

  return (
    <div className="admin-coming">
      <header className="admin-coming__hero">
        <div className="admin-coming__icon">
          <HeroIcon width={26} height={26} />
        </div>
        <div className="admin-coming__badge">
          <Icon.sparkles width={12} height={12} />
          {eyebrow} · Coming soon
        </div>
        <h1 className="admin-coming__title">{title}</h1>
        <p className="admin-coming__desc">{description}</p>
        <div className="admin-coming__cta">
          <button type="button" className="admin-button admin-button--primary" disabled>
            <Icon.bell width={15} height={15} />
            Notify me on release
          </button>
          <button type="button" className="admin-button" disabled>
            <Icon.external width={15} height={15} />
            View product brief
          </button>
        </div>
      </header>

      <div>
        <div className="admin-section-title" style={{ marginBottom: 12 }}>
          Delivery roadmap
        </div>
        <div className="admin-roadmap">
          {roadmap.map((entry) => (
            <article key={entry.title} className="admin-roadmap__card">
              <div className="admin-roadmap__phase">{entry.phase}</div>
              <h3 className="admin-roadmap__card-title">{entry.title}</h3>
              <p className="admin-roadmap__card-desc">{entry.description}</p>
              <div className="admin-roadmap__eta">
                <Icon.clock width={13} height={13} />
                {entry.eta}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-split">
        <SectionCard title="Planned features" subtitle="Scoped for the first release">
          <div className="admin-feature-list">
            {plannedFeatures.map((feature) => (
              <div key={feature} className="admin-feature-list__item">
                <span className="admin-feature-list__check">
                  <Icon.check width={13} height={13} />
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Expected integrations"
          subtitle="Systems this module will connect to"
        >
          <div className="admin-row" style={{ gap: 8 }}>
            {integrations.map((integration) => (
              <span key={integration} className="admin-tag">
                <Icon.plug width={12} height={12} />
                {integration}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>

      {preview !== 'none' && (
        <div className="admin-preview">
          <span className="admin-preview__lock">
            <Icon.shield width={12} height={12} />
            Preview · not yet available
          </span>
          <div className="admin-preview__content">
            {preview === 'chart' ? (
              <div className="admin-preview__bars">
                {[56, 78, 44, 92, 67, 81, 50, 73].map((value, index) => (
                  <span key={index} style={{ height: `${value}%` }} />
                ))}
              </div>
            ) : (
              <div className="admin-preview__rows">
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="admin-preview__row">
                    {[32, 18, 22, 14, 10].map((width, cellIndex) => (
                      <span
                        key={cellIndex}
                        className="admin-preview__cell"
                        style={{ width: `${width}%` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
