import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getCustomerLeads } from "@/lib/lead-export";
import { DEFAULT_FOLLOWUP, type ContactFollowup } from "@/lib/admin-leads";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function GET() {
  if (
    !(await verifyAdminToken((await cookies()).get("admin_auth")?.value ?? ""))
  )
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers },
    );
  try {
    const client = createAdminClient();
    const followups = new Map<string, ContactFollowup>();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("contact_lead_followup")
        .select(
          "contact_lead_id,status,assignee,follow_up_at,internal_note,version",
        )
        .order("contact_lead_id")
        .range(offset, offset + 499);
      if (error) throw new Error("Follow-up unavailable");
      for (const row of data ?? [])
        followups.set(row.contact_lead_id, row as ContactFollowup);
      if ((data ?? []).length < 500) break;
    }
    const leads = await getCustomerLeads();
    return NextResponse.json(
      {
        data: leads
          .map((lead) => ({
            ...lead,
            followup: lead.key.startsWith("contact:")
              ? (followups.get(lead.key.slice(8)) ?? DEFAULT_FOLLOWUP)
              : null,
          }))
          .reverse(),
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "לא ניתן לטעון את הפניות כרגע. נסו שוב." },
      { status: 503, headers },
    );
  }
}
