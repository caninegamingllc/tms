import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ASSET_STATUSES,
  DRIVER_STATUSES,
  TRAILER_TYPES,
  TRUCK_OWNERSHIPS
} from "@/lib/fleet-constants";
import { createDriver, createTrailer, createTruck } from "@/lib/fleet-actions";
import { formatLocalDate } from "@/lib/dates";

function dateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return formatLocalDate(d);
}

export function DriverForm({
  action,
  driver
}: {
  action: (formData: FormData) => Promise<void>;
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
    employeeNumber?: string | null;
    status: string;
    hireDate?: Date | null;
    terminationDate?: Date | null;
    dateOfBirth?: Date | null;
    cdlNumber?: string | null;
    cdlClass?: string | null;
    cdlState?: string | null;
    cdlEndorsements?: string | null;
    cdlExpiresAt?: Date | null;
    medicalExpiresAt?: Date | null;
    notes?: string | null;
  };
}) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {driver ? <input type="hidden" name="driverId" value={driver.id} /> : null}
      <label className="grid gap-1">
        <span className="label">First name</span>
        <input className="input" name="firstName" required defaultValue={driver?.firstName ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Last name</span>
        <input className="input" name="lastName" required defaultValue={driver?.lastName ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Phone</span>
        <input className="input" name="phone" defaultValue={driver?.phone ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Email</span>
        <input className="input" name="email" type="email" defaultValue={driver?.email ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Employee #</span>
        <input className="input" name="employeeNumber" defaultValue={driver?.employeeNumber ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Status</span>
        <select className="input" name="status" defaultValue={driver?.status ?? "ACTIVE"}>
          {DRIVER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Hire date</span>
        <DatePicker name="hireDate" defaultValue={dateInputValue(driver?.hireDate)} placeholder="Hire date" />
      </label>
      <label className="grid gap-1">
        <span className="label">Termination date</span>
        <DatePicker
          name="terminationDate"
          defaultValue={dateInputValue(driver?.terminationDate)}
          placeholder="Termination date"
        />
      </label>
      <label className="grid gap-1">
        <span className="label">Date of birth</span>
        <DatePicker
          name="dateOfBirth"
          defaultValue={dateInputValue(driver?.dateOfBirth)}
          placeholder="Date of birth"
        />
      </label>
      <label className="grid gap-1">
        <span className="label">CDL number</span>
        <input className="input" name="cdlNumber" defaultValue={driver?.cdlNumber ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">CDL class</span>
        <input className="input" name="cdlClass" placeholder="A / B / C" defaultValue={driver?.cdlClass ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">CDL state</span>
        <input className="input" name="cdlState" maxLength={2} defaultValue={driver?.cdlState ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Endorsements</span>
        <input className="input" name="cdlEndorsements" defaultValue={driver?.cdlEndorsements ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">CDL expiration</span>
        <DatePicker
          name="cdlExpiresAt"
          defaultValue={dateInputValue(driver?.cdlExpiresAt)}
          placeholder="CDL expiration"
        />
      </label>
      <label className="grid gap-1">
        <span className="label">Medical card expiration</span>
        <DatePicker
          name="medicalExpiresAt"
          defaultValue={dateInputValue(driver?.medicalExpiresAt)}
          placeholder="Medical card expiration"
        />
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Notes</span>
        <textarea className="input min-h-[80px]" name="notes" defaultValue={driver?.notes ?? ""} />
      </label>
      <div className="sm:col-span-2">
        <button className="btn" type="submit">
          {driver ? "Save driver" : "Add driver"}
        </button>
      </div>
    </form>
  );
}

export function TruckForm({
  action,
  truck
}: {
  action: (formData: FormData) => Promise<void>;
  truck?: {
    id: string;
    unitNumber: string;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    vin?: string | null;
    licensePlate?: string | null;
    licenseState?: string | null;
    status: string;
    ownership: string;
    registrationExpiresAt?: Date | null;
    annualInspectionExpiresAt?: Date | null;
    irpExpiresAt?: Date | null;
    insuranceExpiresAt?: Date | null;
    notes?: string | null;
  };
}) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {truck ? <input type="hidden" name="truckId" value={truck.id} /> : null}
      <label className="grid gap-1">
        <span className="label">Unit #</span>
        <input className="input" name="unitNumber" required defaultValue={truck?.unitNumber ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Year</span>
        <input className="input" name="year" type="number" defaultValue={truck?.year ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Make</span>
        <input className="input" name="make" defaultValue={truck?.make ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Model</span>
        <input className="input" name="model" defaultValue={truck?.model ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">VIN</span>
        <input className="input" name="vin" defaultValue={truck?.vin ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">License plate</span>
        <input className="input" name="licensePlate" defaultValue={truck?.licensePlate ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">License state</span>
        <input className="input" name="licenseState" maxLength={2} defaultValue={truck?.licenseState ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Status</span>
        <select className="input" name="status" defaultValue={truck?.status ?? "ACTIVE"}>
          {ASSET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Ownership</span>
        <select className="input" name="ownership" defaultValue={truck?.ownership ?? "COMPANY"}>
          {TRUCK_OWNERSHIPS.map((ownership) => (
            <option key={ownership} value={ownership}>
              {ownership.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Registration expiration</span>
        <DatePicker
          name="registrationExpiresAt"
          defaultValue={dateInputValue(truck?.registrationExpiresAt)}
          placeholder="Registration expiration"
        />
      </label>
      <label className="grid gap-1">
        <span className="label">Annual inspection expiration</span>
        <DatePicker
          name="annualInspectionExpiresAt"
          defaultValue={dateInputValue(truck?.annualInspectionExpiresAt)}
          placeholder="Annual inspection expiration"
        />
      </label>
      <label className="grid gap-1">
        <span className="label">IRP / cab card expiration</span>
        <DatePicker
          name="irpExpiresAt"
          defaultValue={dateInputValue(truck?.irpExpiresAt)}
          placeholder="IRP / cab card expiration"
        />
      </label>
      <label className="grid gap-1">
        <span className="label">Insurance expiration</span>
        <DatePicker
          name="insuranceExpiresAt"
          defaultValue={dateInputValue(truck?.insuranceExpiresAt)}
          placeholder="Insurance expiration"
        />
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Notes</span>
        <textarea className="input min-h-[80px]" name="notes" defaultValue={truck?.notes ?? ""} />
      </label>
      <div className="sm:col-span-2">
        <button className="btn" type="submit">
          {truck ? "Save tractor" : "Add tractor"}
        </button>
      </div>
    </form>
  );
}

export function TrailerForm({
  action,
  trailer
}: {
  action: (formData: FormData) => Promise<void>;
  trailer?: {
    id: string;
    unitNumber: string;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    vin?: string | null;
    licensePlate?: string | null;
    licenseState?: string | null;
    trailerType: string;
    status: string;
    registrationExpiresAt?: Date | null;
    annualInspectionExpiresAt?: Date | null;
    insuranceExpiresAt?: Date | null;
    notes?: string | null;
  };
}) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {trailer ? <input type="hidden" name="trailerId" value={trailer.id} /> : null}
      <label className="grid gap-1">
        <span className="label">Unit #</span>
        <input className="input" name="unitNumber" required defaultValue={trailer?.unitNumber ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Type</span>
        <select className="input" name="trailerType" defaultValue={trailer?.trailerType ?? "Dry Van"}>
          {TRAILER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Year</span>
        <input className="input" name="year" type="number" defaultValue={trailer?.year ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Make</span>
        <input className="input" name="make" defaultValue={trailer?.make ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Model</span>
        <input className="input" name="model" defaultValue={trailer?.model ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">VIN</span>
        <input className="input" name="vin" defaultValue={trailer?.vin ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">License plate</span>
        <input className="input" name="licensePlate" defaultValue={trailer?.licensePlate ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">License state</span>
        <input className="input" name="licenseState" maxLength={2} defaultValue={trailer?.licenseState ?? ""} />
      </label>
      <label className="grid gap-1">
        <span className="label">Status</span>
        <select className="input" name="status" defaultValue={trailer?.status ?? "ACTIVE"}>
          {ASSET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Registration expiration</span>
        <DatePicker
          name="registrationExpiresAt"
          defaultValue={dateInputValue(trailer?.registrationExpiresAt)}
          placeholder="Registration expiration"
        />
      </label>
      <label className="grid gap-1">
        <span className="label">Annual inspection expiration</span>
        <DatePicker
          name="annualInspectionExpiresAt"
          defaultValue={dateInputValue(trailer?.annualInspectionExpiresAt)}
          placeholder="Annual inspection expiration"
        />
      </label>
      <label className="grid gap-1">
        <span className="label">Insurance expiration</span>
        <DatePicker
          name="insuranceExpiresAt"
          defaultValue={dateInputValue(trailer?.insuranceExpiresAt)}
          placeholder="Insurance expiration"
        />
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Notes</span>
        <textarea className="input min-h-[80px]" name="notes" defaultValue={trailer?.notes ?? ""} />
      </label>
      <div className="sm:col-span-2">
        <button className="btn" type="submit">
          {trailer ? "Save trailer" : "Add trailer"}
        </button>
      </div>
    </form>
  );
}

export function CreateDriverPanel() {
  return <DriverForm action={createDriver} />;
}

export function CreateTruckPanel() {
  return <TruckForm action={createTruck} />;
}

export function CreateTrailerPanel() {
  return <TrailerForm action={createTrailer} />;
}

export function FleetListLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-primary underline">
      {children}
    </Link>
  );
}
