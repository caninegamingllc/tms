"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  defaultFollowUpDateTime,
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDate,
  parseLocalDateTime,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  name?: string;
  id?: string;
  required?: boolean;
  defaultValue?: string;
  /** Controlled value as `YYYY-MM-DD`. */
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
};

function displayDate(date: Date | undefined) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function displayDateTime(date: Date | undefined) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function to12HourParts(date: Date) {
  const hour24 = date.getHours();
  const minute = date.getMinutes();
  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, period: period as "AM" | "PM" };
}

function from12HourParts(base: Date, hour12: number, minute: number, period: "AM" | "PM") {
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;
  const next = new Date(base);
  next.setHours(hour24, minute, 0, 0);
  return next;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 15, 30, 45];

export function DatePicker({
  name,
  id,
  required,
  defaultValue,
  value: valueProp,
  onChange,
  className,
  placeholder = "Pick a date",
}: DatePickerProps) {
  const isControlled = valueProp !== undefined;
  const initial = defaultValue ? parseLocalDate(defaultValue) ?? undefined : undefined;
  const [open, setOpen] = React.useState(false);
  const [uncontrolledDate, setUncontrolledDate] = React.useState<Date | undefined>(initial);

  const date = isControlled
    ? valueProp
      ? parseLocalDate(valueProp) ?? undefined
      : undefined
    : uncontrolledDate;

  function setDate(next: Date | undefined) {
    if (!isControlled) {
      setUncontrolledDate(next);
    }
    onChange?.(next ? formatLocalDate(next) : "");
  }

  const value = date ? formatLocalDate(date) : "";

  return (
    <div className={cn("w-full", className)}>
      {name ? <input type="hidden" id={id} name={name} value={value} required={required} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 w-full justify-start px-3 font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 opacity-70" />
            {displayDate(date) ?? placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(next) => {
              setDate(next);
              setOpen(false);
            }}
            defaultMonth={date}
          />
          {!required ? (
            <div className="border-border border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setDate(undefined);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

type DateTimePickerProps = DatePickerProps & {
  /** When true and no defaultValue, seed to today at 9:00 AM. */
  defaultToNineAm?: boolean;
};

export function DateTimePicker({
  name,
  id,
  required,
  defaultValue,
  value: valueProp,
  onChange,
  className,
  placeholder = "Pick date & time",
  defaultToNineAm = false,
}: DateTimePickerProps) {
  const isControlled = valueProp !== undefined;
  const initial = defaultValue
    ? parseLocalDateTime(defaultValue) ?? undefined
    : defaultToNineAm
      ? defaultFollowUpDateTime()
      : undefined;
  const [open, setOpen] = React.useState(false);
  const [uncontrolledDate, setUncontrolledDate] = React.useState<Date | undefined>(initial);

  const date = isControlled
    ? valueProp
      ? parseLocalDateTime(valueProp) ?? undefined
      : undefined
    : uncontrolledDate;

  function setDate(next: Date | undefined) {
    if (!isControlled) {
      setUncontrolledDate(next);
    }
    onChange?.(next ? formatLocalDateTime(next) : "");
  }

  const parts = date ? to12HourParts(date) : { hour12: 9, minute: 0, period: "AM" as const };
  const value = date ? formatLocalDateTime(date) : "";

  function ensureDate(base?: Date) {
    return base ?? defaultFollowUpDateTime();
  }

  return (
    <div className={cn("w-full", className)}>
      {name ? <input type="hidden" id={id} name={name} value={value} required={required} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 w-full justify-start px-3 font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 opacity-70" />
            {displayDateTime(date) ?? placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(next) => {
              if (!next) {
                setDate(undefined);
                return;
              }
              const withTime = ensureDate(date);
              const merged = new Date(next);
              merged.setHours(withTime.getHours(), withTime.getMinutes(), 0, 0);
              setDate(merged);
            }}
            defaultMonth={date}
          />
          <div className="border-border flex items-center gap-2 border-t p-3">
            <select
              aria-label="Hour"
              className="select-no-chevron border-border bg-card h-8 rounded-md border px-2 text-sm"
              value={parts.hour12}
              onChange={(e) => {
                const hour12 = Number(e.target.value);
                setDate(from12HourParts(ensureDate(date), hour12, parts.minute, parts.period));
              }}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground text-sm">:</span>
            <select
              aria-label="Minute"
              className="select-no-chevron border-border bg-card h-8 rounded-md border px-2 text-sm"
              value={parts.minute}
              onChange={(e) => {
                const minute = Number(e.target.value);
                setDate(from12HourParts(ensureDate(date), parts.hour12, minute, parts.period));
              }}
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
              {date && !MINUTES.includes(date.getMinutes()) ? (
                <option value={date.getMinutes()}>{String(date.getMinutes()).padStart(2, "0")}</option>
              ) : null}
            </select>
            <select
              aria-label="AM/PM"
              className="select-no-chevron border-border bg-card h-8 rounded-md border px-2 text-sm"
              value={parts.period}
              onChange={(e) => {
                const period = e.target.value as "AM" | "PM";
                setDate(from12HourParts(ensureDate(date), parts.hour12, parts.minute, period));
              }}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
          <div className="border-border flex gap-2 border-t p-2">
            {!required ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setDate(undefined);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
            <Button type="button" size="sm" className="flex-1" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
