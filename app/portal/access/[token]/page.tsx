import { redeemPortalAccessToken } from "@/lib/portal-auth";

export default async function PortalAccessPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await redeemPortalAccessToken(token);
  return null;
}
