import type { ReactNode, SVGProps } from 'react';

/** Hand-drawn heart outline, like the doodles on the shop's posts. Purely decorative. */
export function HeartDoodle({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 44"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d="M24 40C14 32 4 24 4.5 14.5 5 7.5 10.5 3.5 16 4c4 .4 6.6 3 8 6.5 1.6-3.8 4.6-6.4 9-6.5 6-.2 10.8 4.6 10.5 11-.4 9-10 16.5-19.2 24.6" />
      <path d="M22.5 38.5c.8.6 1.6 1 2.6 1.4" />
    </svg>
  );
}

/** Loose underline stroke with a heart, as used under the product blurbs. */
export function HeartFlourish({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 30"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M14 24C8 19 3 15 3.3 10.3 3.6 6.8 6.3 4.8 9 5c2 .2 3.3 1.5 4 3.3.8-1.9 2.3-3.2 4.5-3.3 3-.1 5.4 2.3 5.3 5.5-.2 4.6-5 8.4-9.8 13.5" />
      <path d="M38 17c20-4 45-6 78-7" />
    </svg>
  );
}

/** Script phrase on a painted brush stroke ("Odmah dostupna!"). */
export function BrushText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`brush font-script text-espresso-900 ${className}`}>{children}</span>;
}

/** Dark-circle icon + latte pill, the feature-list style from the "Vratili smo se" post. */
export function FeaturePill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-crema-100/95 py-1.5 pr-5 pl-1.5 shadow-(--shadow-card) ring-1 ring-espresso-900/10 backdrop-blur">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-espresso-900 text-crema-100 ring-2 ring-crema-100">
        {icon}
      </span>
      <span className="text-[0.95rem] leading-tight font-semibold text-espresso-900">{children}</span>
    </div>
  );
}

/** Section heading: a small script kicker with a heart, then the serif title. */
export function SectionTitle({
  id,
  kicker,
  children,
  className = '',
}: {
  id?: string;
  kicker?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {kicker && (
        <p className="flex items-center gap-1.5 font-script text-2xl text-roast-500" aria-hidden="true">
          {kicker}
          <HeartDoodle className="size-5" />
        </p>
      )}
      <h2 id={id} className="text-3xl font-bold sm:text-4xl">
        {children}
      </h2>
    </div>
  );
}
