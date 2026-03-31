"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type"
>;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, disabled, id: idProp, ...props }, ref) {
    const [show, setShow] = React.useState(false);
    const inputId = idProp ?? "password-input";

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          type={show ? "text" : "password"}
          disabled={disabled}
          className={cn("pr-10", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-0.5 -translate-y-1/2 rounded-md"
          onClick={() => setShow((v) => !v)}
          aria-controls={inputId}
          aria-pressed={show}
          aria-label={show ? "Skjul passord" : "Vis passord"}
        >
          {show ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </Button>
      </div>
    );
  },
);

export { PasswordInput };
