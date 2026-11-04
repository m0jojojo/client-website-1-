import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`border-border bg-background overflow-hidden rounded-sm border ${className}`.trim()}
      {...props}
    />
  );
}
