"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { branchFilterCookieName } from "@/lib/branch-filter-server";
import { getAllowedBranchIds, hasBranchSwitcher } from "@/lib/scope";
import { prisma } from "@/lib/db";

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }
  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

export async function setBranchFilter(formData: FormData) {
  const user = await requireUser();

  if (!hasBranchSwitcher(user)) {
    throw new Error("You do not have permission to change the branch filter.");
  }

  const branchIds = formData
    .getAll("branchIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const allBranches = formData.get("allBranches") === "true";
  const cookieStore = await cookies();

  if (allBranches || branchIds.length === 0) {
    cookieStore.delete(branchFilterCookieName);
    revalidatePath("/", "layout");
    return;
  }

  const allowed = getAllowedBranchIds(user);
  const companyBranches = await prisma.branch.findMany({
    where: {
      companyId: user.companyId,
      ...(allowed ? { id: { in: allowed } } : {})
    },
    select: { id: true }
  });
  const validIds = new Set(companyBranches.map((branch) => branch.id));
  const selected = branchIds.filter((id) => validIds.has(id));

  if (selected.length === 0 || selected.length === validIds.size) {
    cookieStore.delete(branchFilterCookieName);
  } else {
    cookieStore.set(branchFilterCookieName, selected.join(","), {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  revalidatePath("/", "layout");
}

export async function clearBranchFilterCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(branchFilterCookieName);
}
