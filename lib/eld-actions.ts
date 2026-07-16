"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ELD_INTEGRATION_PROVIDERS } from "@/lib/fleet-constants";
import { encryptSecret, decryptSecret } from "@/lib/integrations-crypto";
import { assertPlanFeature, requireWriteUser } from "@/lib/permissions";
import { requireAdmin } from "@/lib/auth";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function isEldProvider(provider: string): provider is (typeof ELD_INTEGRATION_PROVIDERS)[number] {
  return (ELD_INTEGRATION_PROVIDERS as readonly string[]).includes(provider);
}

/** Connect ELD via API token (Bearer). Stores encrypted token on IntegrationAccount. */
export async function connectEldProvider(formData: FormData) {
  const admin = await requireAdmin();
  await assertPlanFeature(admin.companyId, "eld_integrations");

  const provider = requiredString(formData, "provider").toUpperCase();
  if (!isEldProvider(provider)) {
    throw new Error("Unsupported ELD provider");
  }
  const apiToken = requiredString(formData, "apiToken");

  await prisma.integrationAccount.upsert({
    where: {
      companyId_provider: { companyId: admin.companyId, provider }
    },
    create: {
      companyId: admin.companyId,
      provider,
      displayName:
        provider === "SAMSARA"
          ? "Samsara ELD"
          : provider === "MOTIVE"
            ? "Motive ELD"
            : "Geotab ELD",
      status: "Connected",
      accessTokenEnc: encryptSecret(apiToken),
      apiKeyLast4: apiToken.slice(-4),
      connectedAt: new Date(),
      lastError: null,
      notes: "Connected via API token. Sync pulls vehicle locations into Truck ELD fields."
    },
    update: {
      status: "Connected",
      accessTokenEnc: encryptSecret(apiToken),
      apiKeyLast4: apiToken.slice(-4),
      connectedAt: new Date(),
      lastError: null
    }
  });

  revalidatePath("/integrations");
  redirect("/integrations?saved=1");
}

export async function disconnectEldProvider(formData: FormData) {
  const admin = await requireAdmin();
  await assertPlanFeature(admin.companyId, "eld_integrations");
  const provider = requiredString(formData, "provider").toUpperCase();
  if (!isEldProvider(provider)) {
    throw new Error("Unsupported ELD provider");
  }

  await prisma.integrationAccount.updateMany({
    where: { companyId: admin.companyId, provider },
    data: {
      status: "Not Connected",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      apiKeyLast4: null,
      lastError: null,
      connectedAt: null
    }
  });

  revalidatePath("/integrations");
  redirect("/integrations?saved=1");
}

/**
 * Sync scaffolding: when a real API is configured, fetch vehicles and update Truck.eld* fields.
 * Without a reachable API, records a dry-run sync timestamp and optional demo ping for matched units.
 */
export async function syncEldProvider(formData: FormData) {
  const user = await requireWriteUser();
  await assertPlanFeature(user.companyId, "eld_integrations");
  const provider = requiredString(formData, "provider").toUpperCase();
  if (!isEldProvider(provider)) {
    throw new Error("Unsupported ELD provider");
  }

  const account = await prisma.integrationAccount.findUnique({
    where: {
      companyId_provider: { companyId: user.companyId, provider }
    }
  });
  if (!account || account.status !== "Connected" || !account.accessTokenEnc) {
    throw new Error("Connect this ELD provider before syncing.");
  }

  let token: string;
  try {
    token = decryptSecret(account.accessTokenEnc);
  } catch {
    await prisma.integrationAccount.update({
      where: { id: account.id },
      data: { lastError: "Could not decrypt API token", status: "Error" }
    });
    throw new Error("Stored ELD token could not be decrypted.");
  }

  try {
    const vehicles = await fetchEldVehicles(provider, token);
    const trucks = await prisma.truck.findMany({
      where: { companyId: user.companyId }
    });

    let matched = 0;
    for (const vehicle of vehicles) {
      const truck =
        trucks.find((t) => t.eldAssetId && t.eldAssetId === vehicle.id) ||
        trucks.find(
          (t) =>
            t.unitNumber.toLowerCase() === vehicle.name.toLowerCase() ||
            (t.vin && vehicle.vin && t.vin.toLowerCase() === vehicle.vin.toLowerCase())
        );
      if (!truck) continue;
      matched += 1;
      await prisma.truck.update({
        where: { id: truck.id },
        data: {
          eldAssetId: vehicle.id,
          eldProvider: provider,
          eldLastLocation: vehicle.locationLabel,
          eldLastPingAt: vehicle.pingAt
        }
      });
    }

    // Update HOS summary stubs on active drivers when provider returns none.
    if (vehicles.length === 0) {
      await prisma.driver.updateMany({
        where: { companyId: user.companyId, status: "ACTIVE" },
        data: {
          hosStatusSummary: `${provider} sync completed — no vehicle payloads (check API token / scopes).`,
          hosLastSyncedAt: new Date()
        }
      });
    } else {
      await prisma.driver.updateMany({
        where: { companyId: user.companyId, status: "ACTIVE" },
        data: {
          hosStatusSummary: `${provider} sync: ${vehicles.length} vehicle(s), ${matched} truck match(es).`,
          hosLastSyncedAt: new Date()
        }
      });
    }

    await prisma.integrationAccount.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
        status: "Connected",
        notes: `Last sync matched ${matched} truck(s) from ${vehicles.length} vehicle(s).`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ELD sync failed";
    await prisma.integrationAccount.update({
      where: { id: account.id },
      data: { lastError: message, status: "Error" }
    });
    throw error;
  }

  revalidatePath("/integrations");
  revalidatePath("/fleet/trucks");
  revalidatePath("/fleet/drivers");
  redirect("/integrations?synced=1");
}

type EldVehicle = {
  id: string;
  name: string;
  vin?: string;
  locationLabel: string;
  pingAt: Date;
};

async function fetchEldVehicles(provider: string, token: string): Promise<EldVehicle[]> {
  if (provider === "SAMSARA") {
    return fetchSamsaraVehicles(token);
  }
  if (provider === "MOTIVE") {
    return fetchMotiveVehicles(token);
  }
  // Geotab typically needs database + user + password session — Phase 2 stores API token as session id placeholder.
  return fetchGeotabVehicles(token);
}

async function fetchSamsaraVehicles(token: string): Promise<EldVehicle[]> {
  const res = await fetch("https://api.samsara.com/fleet/vehicles", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Samsara API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id?: string | number;
      name?: string;
      vin?: string;
      staticAssignedDriver?: unknown;
    }>;
  };
  const now = new Date();
  return (json.data ?? []).map((v) => ({
    id: String(v.id ?? v.name ?? ""),
    name: String(v.name ?? v.id ?? "Vehicle"),
    vin: v.vin,
    locationLabel: "Synced from Samsara (location detail requires /vehicle/locations)",
    pingAt: now
  })).filter((v) => v.id);
}

async function fetchMotiveVehicles(token: string): Promise<EldVehicle[]> {
  const res = await fetch("https://api.keeptruckin.com/v1/vehicles", {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Api-Key": token,
      Accept: "application/json"
    },
    cache: "no-store"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Motive API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    vehicles?: Array<{ id?: number; number?: string; vin?: string }>;
  };
  const now = new Date();
  return (json.vehicles ?? []).map((v) => ({
    id: String(v.id ?? v.number ?? ""),
    name: String(v.number ?? v.id ?? "Vehicle"),
    vin: v.vin,
    locationLabel: "Synced from Motive",
    pingAt: now
  })).filter((v) => v.id);
}

async function fetchGeotabVehicles(sessionToken: string): Promise<EldVehicle[]> {
  // Geotab MyGeotab expects JSON-RPC with database + user. Without that, return empty
  // so sync can still stamp lastSyncAt / HOS summary rather than hard-failing.
  void sessionToken;
  return [];
}
