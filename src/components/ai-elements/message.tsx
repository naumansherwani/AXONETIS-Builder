"use client";

import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

type MessageResponseProps = {
  children: string;
  className?: string;
};

export function MessageResponse({ children, className }: MessageResponseProps) {
  return (
    <Streamdown
      className={cn(
        "text-[14px] leading-relaxed text-foreground/90 [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/40 [&_pre]:p-3",
        className,
      )}
    >
      {children}
    </Streamdown>
  );
}
