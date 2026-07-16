import Link from "next/link";
import { deleteDqfItem, upsertDqfItem } from "@/lib/dqf-actions";
import { DQF_CATEGORIES } from "@/lib/fleet-constants";
import { formatDate, humanize } from "@/lib/format";

type Item = {
  id: string;
  category: string;
  title: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  status: string;
  notes: string | null;
  filePath: string | null;
  originalFileName: string | null;
};

function dateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function DqfSection({ driverId, items }: { driverId: string; items: Item[] }) {
  return (
    <div className="card mt-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Driver Qualification File</h2>
          <p className="muted mt-1">
            Maintain DOT-ready qualification documents. Upload files and track expirations for audits.
          </p>
        </div>
        <Link
          href={`/api/fleet/dqf/${driverId}/packet`}
          className="btn-secondary"
          target="_blank"
          rel="noreferrer"
        >
          Export DQF packet
        </Link>
      </div>

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{humanize(item.category)}</p>
              </div>
              <span
                className={`badge ${
                  item.status === "EXPIRED" || item.status === "MISSING"
                    ? "bg-rose-100 text-rose-800"
                    : item.status === "CURRENT"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {humanize(item.status)}
              </span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Issued {formatDate(item.issuedAt)} · Expires {formatDate(item.expiresAt)}
              {item.originalFileName ? ` · File: ${item.originalFileName}` : " · No file uploaded"}
            </p>
            <form action={upsertDqfItem} className="grid gap-3 sm:grid-cols-2" encType="multipart/form-data">
              <input type="hidden" name="driverId" value={driverId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="category" value={item.category} />
              <label className="grid gap-1">
                <span className="label">Title</span>
                <input className="input" name="title" defaultValue={item.title} />
              </label>
              <label className="grid gap-1">
                <span className="label">Issued</span>
                <input className="input" name="issuedAt" type="date" defaultValue={dateInputValue(item.issuedAt)} />
              </label>
              <label className="grid gap-1">
                <span className="label">Expires</span>
                <input
                  className="input"
                  name="expiresAt"
                  type="date"
                  defaultValue={dateInputValue(item.expiresAt)}
                />
              </label>
              <label className="grid gap-1">
                <span className="label">Upload / replace file</span>
                <input className="input" name="file" type="file" accept=".pdf,image/*" />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="label">Notes</span>
                <textarea className="input min-h-[60px]" name="notes" defaultValue={item.notes ?? ""} />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button className="btn" type="submit">
                  Save item
                </button>
              </div>
            </form>
            <form action={deleteDqfItem} className="mt-2">
              <input type="hidden" name="driverId" value={driverId} />
              <input type="hidden" name="itemId" value={item.id} />
              <button className="text-sm font-semibold text-rose-700 underline" type="submit">
                Remove item
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border p-4">
        <h3 className="mb-3 text-sm font-semibold">Add optional DQF document</h3>
        <form action={upsertDqfItem} className="grid gap-3 sm:grid-cols-2" encType="multipart/form-data">
          <input type="hidden" name="driverId" value={driverId} />
          <label className="grid gap-1">
            <span className="label">Category</span>
            <select className="input" name="category" defaultValue="TRAINING">
              {DQF_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Title</span>
            <input className="input" name="title" />
          </label>
          <label className="grid gap-1">
            <span className="label">Issued</span>
            <input className="input" name="issuedAt" type="date" />
          </label>
          <label className="grid gap-1">
            <span className="label">Expires</span>
            <input className="input" name="expiresAt" type="date" />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="label">File</span>
            <input className="input" name="file" type="file" accept=".pdf,image/*" />
          </label>
          <div className="sm:col-span-2">
            <button className="btn" type="submit">
              Add document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
