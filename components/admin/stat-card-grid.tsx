export function StatCardGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return (
    <div className={cols === 3 ? "grid grid-cols-3 gap-4" : "grid grid-cols-2 md:grid-cols-4 gap-4"}>{children}</div>
  );
}
