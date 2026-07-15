"use client";

import Link from "next/link";

type Props = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** When true, renders as an uncontrolled required form checkbox (no checked/onChange). */
  required?: boolean;
  id?: string;
};

export function LegalAcceptanceCheckbox({
  checked,
  onChange,
  required = true,
  id = "acceptedLegal"
}: Props) {
  const controlled = typeof checked === "boolean" && typeof onChange === "function";

  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
      <input
        id={id}
        type="checkbox"
        value="on"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
        required={required}
        {...(controlled
          ? { checked, onChange: (event) => onChange(event.target.checked) }
          : { name: "acceptedLegal" })}
      />
      <span className="text-muted-foreground">
        I agree to the{" "}
        <Link href="/terms" className="font-semibold text-primary" target="_blank" rel="noreferrer">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="font-semibold text-primary"
          target="_blank"
          rel="noreferrer"
        >
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  );
}
