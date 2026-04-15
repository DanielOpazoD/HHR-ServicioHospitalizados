import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

/** Single pulsing skeleton bar. Size it with className (h-*, w-*). */
export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={clsx('animate-pulse rounded bg-slate-200/70', className)} />
);

/** Skeleton that mimics a census-style data table. */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 10,
  cols = 8,
}) => (
  <div className="card print:hidden">
    {/* Header row */}
    <div className="flex gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50/50">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={clsx('h-3', i === 0 ? 'w-12' : i === 1 ? 'w-24' : 'w-16')} />
      ))}
    </div>
    {/* Data rows */}
    {Array.from({ length: rows }).map((_, row) => (
      <div key={row} className="flex gap-2 px-3 py-2 border-b border-slate-100/60 items-center">
        {Array.from({ length: cols }).map((_, col) => (
          <Skeleton
            key={col}
            className={clsx(
              'h-3',
              col === 0 ? 'w-10' : col === 1 ? 'w-28' : col === 2 ? 'w-20' : 'w-14',
              row % 3 === 0 && col > 4 && 'opacity-40'
            )}
          />
        ))}
      </div>
    ))}
  </div>
);

/** Skeleton that mimics the staff header + summary cards area. */
export const StaffHeaderSkeleton: React.FC = () => (
  <div className="flex gap-3 items-center print:hidden">
    {Array.from({ length: 3 }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl border border-slate-200/60 bg-white px-3 py-2 min-w-[140px] min-h-[72px] flex flex-col gap-2"
      >
        <Skeleton className="h-2 w-16" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    ))}
  </div>
);

/** Full-view skeleton combining staff header + table. */
export const CensusViewSkeleton: React.FC = () => (
  <div className="space-y-4 print:hidden">
    <StaffHeaderSkeleton />
    <TableSkeleton />
  </div>
);

/** Generic content skeleton for module views (handoff, etc). */
export const ContentSkeleton: React.FC<{ lines?: number }> = ({ lines = 6 }) => (
  <div className="space-y-3 p-4 print:hidden">
    <Skeleton className="h-4 w-48" />
    <Skeleton className="h-3 w-32" />
    <div className="mt-4 space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={clsx('h-3', i % 2 === 0 ? 'w-full' : 'w-3/4')} />
      ))}
    </div>
  </div>
);
