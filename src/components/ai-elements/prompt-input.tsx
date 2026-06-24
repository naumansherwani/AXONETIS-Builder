"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PromptInputProps = React.FormHTMLAttributes<HTMLFormElement>;

export const PromptInput = React.forwardRef<HTMLFormElement, PromptInputProps>(
  ({ className, ...props }, ref) => (
    <form
      ref={ref}
      className={cn(
        "fb-glass flex flex-col gap-2 rounded-xl p-2 shadow-[0_8px_40px_-12px_oklch(0.58_0.24_25_/_0.25)]",
        className,
      )}
      {...props}
    />
  ),
);
PromptInput.displayName = "PromptInput";

export const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "max-h-[260px] min-h-[44px] w-full resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground/70",
      className,
    )}
    {...props}
  />
));
PromptInputTextarea.displayName = "PromptInputTextarea";

export function PromptInputFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-h-9 items-center justify-between gap-2", className)} {...props} />;
}

type PromptInputSubmitProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  status?: "ready" | "submitted" | "streaming";
  onStop?: () => void;
};

export function PromptInputSubmit({ status = "ready", onStop, disabled, className, ...props }: PromptInputSubmitProps) {
  const busy = status === "submitted" || status === "streaming";
  return (
    <Button
      {...props}
      type={busy ? "button" : "submit"}
      size="icon"
      aria-label={busy ? "Stop response" : "Send message"}
      onClick={busy ? onStop : props.onClick}
      disabled={busy ? false : disabled}
      className={cn("h-9 w-9 shrink-0 rounded-lg", className)}
    >
      {busy ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
    </Button>
  );
}