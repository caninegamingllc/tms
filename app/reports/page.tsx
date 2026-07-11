import { redirect } from "next/navigation";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string" && value) {
      params.set(key, value);
    }
  }

  params.set("view", "revenue");
  redirect(`/search?${params.toString()}`);
}
