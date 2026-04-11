/**
 * SearchResultsSkeleton
 *
 * Placeholder skeleton shown while patient search results are loading.
 * Mimics the layout of PatientSearchResultItem for visual stability.
 */

import React from 'react';

const SKELETON_COUNT = 4;

const SkeletonRow: React.FC = () => (
  <div className="w-full px-4 py-3 flex items-center gap-3 border-l-2 border-transparent animate-pulse">
    {/* Avatar */}
    <div className="shrink-0 w-9 h-9 rounded-full bg-slate-200" />

    {/* Text lines */}
    <div className="flex-1 min-w-0 space-y-2">
      <div className="h-3.5 bg-slate-200 rounded w-3/5" />
      <div className="flex items-center gap-3">
        <div className="h-2.5 bg-slate-100 rounded w-24" />
        <div className="h-2.5 bg-slate-100 rounded w-16" />
      </div>
    </div>

    {/* Badge */}
    <div className="shrink-0 h-4 w-8 bg-slate-100 rounded-full" />
  </div>
);

export const SearchResultsSkeleton: React.FC = () => (
  <div className="py-1">
    <div className="px-4 py-1.5">
      <div className="h-2.5 bg-slate-100 rounded w-20 animate-pulse" />
    </div>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <SkeletonRow key={i} />
    ))}
  </div>
);
