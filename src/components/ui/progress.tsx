interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  return (
    <div className={`relative w-full h-2 bg-gray-200 rounded ${className ?? ""}`}>
      <div
        className="absolute top-0 left-0 h-2 bg-yellow-500 rounded"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
