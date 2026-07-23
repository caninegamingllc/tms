import { prisma } from "@/lib/db";
import { parseLocalDateTime } from "@/lib/dates";

export type StopFacilitySnapshot = {
  facilityId?: string;
  facilityName: string;
  address?: string;
  city: string;
  state: string;
  postalCode?: string;
};

export type ParsedLoadStop = StopFacilitySnapshot & {
  type: "PICKUP" | "DELIVERY";
  appointmentAt: Date;
  appointmentEndAt?: Date;
  instructions?: string;
};

function formValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((value) => String(value ?? ""));
}

function optionalStringValue(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed || undefined;
}

function requiredStringValue(value: string | undefined, label: string) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function parseAppointment(value: string | undefined, label: string) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${label} appointment is required`);
  }
  const date = parseLocalDateTime(trimmed);
  if (!date) {
    throw new Error(`Invalid ${label} appointment`);
  }
  return date;
}

function parseAppointmentEnd(
  hasWindow: boolean,
  value: string | undefined,
  start: Date,
  label: string
): Date | undefined {
  if (!hasWindow) {
    return undefined;
  }
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${label} window end is required`);
  }
  const end = parseLocalDateTime(trimmed);
  if (!end) {
    throw new Error(`Invalid ${label} window end`);
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error(`${label} window end must be after the appointment start`);
  }
  return end;
}

async function resolveFacilitySnapshot(
  formData: FormData,
  index: number,
  companyId: string
): Promise<StopFacilitySnapshot> {
  const facilityId = optionalStringValue(formValues(formData, "stopFacilityId")[index]);
  if (facilityId) {
    const facility = await prisma.facility.findUniqueOrThrow({
      where: { id: facilityId, companyId }
    });
    return {
      facilityId: facility.id,
      facilityName: facility.name,
      address: facility.address ?? undefined,
      city: facility.city,
      state: facility.state,
      postalCode: facility.postalCode ?? undefined
    };
  }

  return {
    facilityName: requiredStringValue(formValues(formData, "stopFacility")[index], "Stop facility"),
    address: optionalStringValue(formValues(formData, "stopAddress")[index]),
    city: requiredStringValue(formValues(formData, "stopCity")[index], "Stop city"),
    state: requiredStringValue(formValues(formData, "stopState")[index], "Stop state"),
    postalCode: optionalStringValue(formValues(formData, "stopPostalCode")[index])
  };
}

export async function parseLoadStopsFromForm(
  formData: FormData,
  companyId: string
): Promise<ParsedLoadStop[]> {
  const types = formValues(formData, "stopType");
  const appointments = formValues(formData, "stopAppointment");
  const hasWindows = formValues(formData, "stopHasWindow");
  const appointmentEnds = formValues(formData, "stopAppointmentEnd");
  const instructions = formValues(formData, "stopInstructions");
  const facilities = formValues(formData, "stopFacility");
  const count = Math.max(types.length, appointments.length, facilities.length);

  if (count === 0) {
    throw new Error("Add at least one pickup and one delivery stop.");
  }

  const stops: ParsedLoadStop[] = [];

  for (let index = 0; index < count; index += 1) {
    const typeRaw = (types[index] ?? "").trim().toUpperCase();
    if (typeRaw !== "PICKUP" && typeRaw !== "DELIVERY") {
      throw new Error("Each stop must be a Pickup or Delivery.");
    }

    const label = typeRaw === "PICKUP" ? "Pickup" : "Delivery";
    const appointmentAt = parseAppointment(appointments[index], label);
    const hasWindow = (hasWindows[index] ?? "").trim() === "1";
    const appointmentEndAt = parseAppointmentEnd(
      hasWindow,
      appointmentEnds[index],
      appointmentAt,
      label
    );

    const facility = await resolveFacilitySnapshot(formData, index, companyId);
    stops.push({
      type: typeRaw,
      ...facility,
      appointmentAt,
      appointmentEndAt,
      instructions: optionalStringValue(instructions[index])
    });
  }

  const hasPickup = stops.some((stop) => stop.type === "PICKUP");
  const hasDelivery = stops.some((stop) => stop.type === "DELIVERY");
  if (!hasPickup || !hasDelivery) {
    throw new Error("A load needs at least one pickup and one delivery.");
  }

  return stops;
}

export function firstPickup(stops: ParsedLoadStop[]) {
  return stops.find((stop) => stop.type === "PICKUP") ?? stops[0];
}

export function lastDelivery(stops: ParsedLoadStop[]) {
  return [...stops].reverse().find((stop) => stop.type === "DELIVERY") ?? stops[stops.length - 1];
}

export function laneTitle(stops: ParsedLoadStop[]) {
  const origin = firstPickup(stops);
  const destination = lastDelivery(stops);
  return `${origin.city}, ${origin.state} → ${destination.city}, ${destination.state}`;
}

export function stopsCreateData(stops: ParsedLoadStop[]) {
  return stops.map((stop, index) => ({
    type: stop.type,
    sequence: index + 1,
    facilityId: stop.facilityId ?? null,
    facilityName: stop.facilityName,
    address: stop.address ?? null,
    city: stop.city,
    state: stop.state,
    postalCode: stop.postalCode ?? null,
    appointmentAt: stop.appointmentAt,
    appointmentEndAt: stop.appointmentEndAt ?? null,
    instructions: stop.instructions ?? null
  }));
}
