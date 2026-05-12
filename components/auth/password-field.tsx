"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PasswordRequirement = {
  label: string;
  test: (password: string) => boolean;
};

export const signUpPasswordRequirements: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (s) => s.length >= 8 },
  { label: "Includes a letter", test: (s) => /[a-zA-Z]/.test(s) },
  { label: "Includes a number", test: (s) => /\d/.test(s) },
];

export function passwordMeetsSignUpRules(password: string): boolean {
  return signUpPasswordRequirements.every((r) => r.test(password));
}

function strengthBarClass(ratio: number): string {
  if (ratio >= 1) return "bg-green-600 dark:bg-green-500";
  if (ratio >= 2 / 3) return "bg-amber-500 dark:bg-amber-400";
  return "bg-destructive/85 dark:bg-destructive";
}

function strengthLabel(met: number, total: number): string {
  if (met === total) return "Strong";
  if (met >= 2) return "Good";
  if (met >= 1) return "Fair";
  return "Weak";
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete: "new-password" | "current-password";
  name?: string;
  /** Strength bar (hidden until user types); rules still drive `passwordMeetsSignUpRules` */
  requirements?: PasswordRequirement[];
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  disabled,
  autoComplete,
  name = "password",
  requirements,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strengthRegionId = useId();

  const { metCount, total, ratio, labelText, allMet } = useMemo(() => {
    if (!requirements) {
      return {
        metCount: 0,
        total: 0,
        ratio: 0,
        labelText: "",
        allMet: true,
      };
    }
    const met = requirements.filter((r) => r.test(value)).length;
    const t = requirements.length;
    const r = t > 0 ? met / t : 0;
    return {
      metCount: met,
      total: t,
      ratio: r,
      labelText: value.length > 0 ? strengthLabel(met, t) : "",
      allMet: met === t,
    };
  }, [requirements, value]);

  const showStrength = Boolean(requirements && value.length > 0);
  const showInvalid = Boolean(requirements && value.length > 0 && !allMet);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required
          className="pr-9"
          aria-invalid={showInvalid || undefined}
          aria-describedby={showStrength ? strengthRegionId : undefined}
        />
        <button
          type="button"
          className={cn(
            "text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-1 outline-none",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            disabled && "pointer-events-none opacity-50",
          )}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? (
            <EyeOff className="size-4 shrink-0" aria-hidden />
          ) : (
            <Eye className="size-4 shrink-0" aria-hidden />
          )}
        </button>
      </div>
      {showStrength ? (
        <div
          id={strengthRegionId}
          className="space-y-1.5"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Password strength</span>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                ratio >= 1 && "text-green-700 dark:text-green-400",
                ratio >= 2 / 3 &&
                  ratio < 1 &&
                  "text-amber-700 dark:text-amber-400",
                ratio < 2 / 3 && "text-destructive",
              )}
            >
              {labelText}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={metCount}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuetext={`${labelText}, ${metCount} of ${total} requirements met`}
            aria-label="Password strength"
            className="bg-muted h-2 w-full overflow-hidden rounded-full"
          >
            <div
              className={cn(
                "h-full max-w-full rounded-full transition-[width,background-color] duration-200 ease-out",
                strengthBarClass(ratio),
              )}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
