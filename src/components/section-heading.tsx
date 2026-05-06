export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">{eyebrow}</div>}
        <h2 className="font-serif text-xl leading-tight md:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
