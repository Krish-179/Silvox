export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-border ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48 mb-3" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Skeleton className="lg:col-span-2 h-64" />
        <Skeleton className="lg:col-span-3 h-64" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="border-t border-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="py-5 border-b border-border flex items-center gap-4"
        >
          <Skeleton className="w-9 h-9 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
