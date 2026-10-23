import React from 'react';

export interface SectionCardProps {
  id?: string;
  sectionTag?: string; // e.g. "SECTION A", "STEP 1"
  title: string;
  subtitle?: string;
  icon?: string;
  theme?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  overflow?: 'hidden' | 'visible';
}

const THEME_STYLES = {
  blue: {
    cardBorder: 'border-slate-200/80 hover:border-sky-300/80',
    cardShadow: 'shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_8px_24px_-4px_rgba(0,99,152,0.08),inset_0_1px_0_0_rgba(255,255,255,1)]',
    iconBg: 'bg-gradient-to-br from-sky-50 to-white text-[#006398] border border-sky-200/90 shadow-[0_2px_6px_rgba(0,99,152,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]',
    tagBg: 'bg-gradient-to-r from-sky-50 to-blue-50/70 text-[#006398] border border-sky-200/80 shadow-[0_1px_2px_rgba(0,99,152,0.05)]',
    accentBorder: 'border-l-[5px] border-l-[#006398]',
    headerBg: 'bg-gradient-to-r from-sky-50/80 via-blue-50/30 to-white/95 border-b border-sky-100/80',
    bodyBg: 'bg-gradient-to-b from-white via-white to-[#f8faff]'
  },
  indigo: {
    cardBorder: 'border-slate-200/80 hover:border-indigo-300/80',
    cardShadow: 'shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_8px_24px_-4px_rgba(79,70,229,0.08),inset_0_1px_0_0_rgba(255,255,255,1)]',
    iconBg: 'bg-gradient-to-br from-indigo-50 to-white text-indigo-700 border border-indigo-200/90 shadow-[0_2px_6px_rgba(79,70,229,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]',
    tagBg: 'bg-gradient-to-r from-indigo-50 to-indigo-100/50 text-indigo-700 border border-indigo-200/80 shadow-[0_1px_2px_rgba(79,70,229,0.05)]',
    accentBorder: 'border-l-[5px] border-l-indigo-600',
    headerBg: 'bg-gradient-to-r from-indigo-50/80 via-indigo-50/25 to-white/95 border-b border-indigo-100/80',
    bodyBg: 'bg-gradient-to-b from-white via-white to-[#f9f9ff]'
  },
  emerald: {
    cardBorder: 'border-slate-200/80 hover:border-emerald-300/80',
    cardShadow: 'shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_8px_24px_-4px_rgba(5,150,105,0.08),inset_0_1px_0_0_rgba(255,255,255,1)]',
    iconBg: 'bg-gradient-to-br from-emerald-50 to-white text-emerald-700 border border-emerald-200/90 shadow-[0_2px_6px_rgba(5,150,105,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]',
    tagBg: 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 border border-emerald-200/80 shadow-[0_1px_2px_rgba(5,150,105,0.05)]',
    accentBorder: 'border-l-[5px] border-l-emerald-600',
    headerBg: 'bg-gradient-to-r from-emerald-50/80 via-emerald-50/25 to-white/95 border-b border-emerald-100/80',
    bodyBg: 'bg-gradient-to-b from-white via-white to-[#f8fcf9]'
  },
  amber: {
    cardBorder: 'border-slate-200/80 hover:border-amber-300/80',
    cardShadow: 'shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_8px_24px_-4px_rgba(217,119,6,0.08),inset_0_1px_0_0_rgba(255,255,255,1)]',
    iconBg: 'bg-gradient-to-br from-amber-50 to-white text-amber-700 border border-amber-200/90 shadow-[0_2px_6px_rgba(217,119,6,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]',
    tagBg: 'bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 border border-amber-200/80 shadow-[0_1px_2px_rgba(217,119,6,0.05)]',
    accentBorder: 'border-l-[5px] border-l-amber-500',
    headerBg: 'bg-gradient-to-r from-amber-50/80 via-amber-50/25 to-white/95 border-b border-amber-100/80',
    bodyBg: 'bg-gradient-to-b from-white via-white to-[#fffef8]'
  },
  rose: {
    cardBorder: 'border-slate-200/80 hover:border-rose-300/80',
    cardShadow: 'shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_8px_24px_-4px_rgba(220,38,38,0.08),inset_0_1px_0_0_rgba(255,255,255,1)]',
    iconBg: 'bg-gradient-to-br from-rose-50 to-white text-rose-700 border border-rose-200/90 shadow-[0_2px_6px_rgba(220,38,38,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]',
    tagBg: 'bg-gradient-to-r from-rose-50 to-rose-100/50 text-rose-700 border border-rose-200/80 shadow-[0_1px_2px_rgba(220,38,38,0.05)]',
    accentBorder: 'border-l-[5px] border-l-rose-500',
    headerBg: 'bg-gradient-to-r from-rose-50/80 via-rose-50/25 to-white/95 border-b border-rose-100/80',
    bodyBg: 'bg-gradient-to-b from-white via-white to-[#fff9f9]'
  },
  slate: {
    cardBorder: 'border-slate-200/80 hover:border-slate-300',
    cardShadow: 'shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_8px_24px_-4px_rgba(15,23,42,0.06),inset_0_1px_0_0_rgba(255,255,255,1)]',
    iconBg: 'bg-gradient-to-br from-slate-100 to-white text-slate-700 border border-slate-200 shadow-[0_2px_6px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]',
    tagBg: 'bg-gradient-to-r from-slate-100 to-slate-200/60 text-slate-700 border border-slate-200 shadow-xs',
    accentBorder: 'border-l-[5px] border-l-slate-500',
    headerBg: 'bg-gradient-to-r from-slate-50 via-slate-50/50 to-white/95 border-b border-slate-200/80',
    bodyBg: 'bg-gradient-to-b from-white via-white to-slate-50/50'
  }
};

export const SectionCard: React.FC<SectionCardProps> = ({
  id,
  sectionTag,
  title,
  subtitle,
  icon,
  theme = 'blue',
  badge,
  actions,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  overflow = 'hidden'
}) => {
  const t = THEME_STYLES[theme] || THEME_STYLES.blue;
  const overflowClass = overflow === 'visible' || className.includes('overflow-visible') ? 'overflow-visible' : 'overflow-hidden';

  return (
    <section id={id} className={`rounded-2xl border ${t.cardBorder} ${t.cardShadow} ${t.accentBorder} ${overflowClass} transition-all duration-200 ${className}`}>
      {/* Section Header */}
      <div className={`p-4 sm:p-5 ${t.headerBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${headerClassName}`}>
        <div className="flex items-start sm:items-center gap-3.5">
          {icon && (
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.iconBg}`}>
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {sectionTag && (
                <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider uppercase ${t.tagBg}`}>
                  {sectionTag}
                </span>
              )}
              <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-sans">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            {actions}
          </div>
        )}
      </div>

      {/* Section Body with Delicate Light Tint Surface */}
      <div className={`p-4 sm:p-6 ${t.bodyBg} ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
};

export default SectionCard;
