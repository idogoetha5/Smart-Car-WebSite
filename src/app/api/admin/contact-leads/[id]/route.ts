import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { followupSchema } from "@/lib/admin-leads";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  if (
    !(await verifyAdminToken((await cookies()).get("admin_auth")?.value ?? ""))
  )
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers },
    );
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(id))
    return NextResponse.json(
      { error: "Invalid contact lead" },
      { status: 400, headers },
    );
  const raw = await request.text();
  if (raw.length > 30_000)
    return NextResponse.json(
      { error: "המידע ארוך מדי" },
      { status: 413, headers },
    );
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers },
    );
  }
  const parsed = followupSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "בדקו את פרטי הטיפול ומועד החזרה" },
      { status: 400, headers },
    );
  const client = createAdminClient();
  const { data: contact, error: contactError } = await client
    .from("contact_leads")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (contactError)
    return NextResponse.json(
      { error: "לא ניתן לשמור כרגע" },
      { status: 503, headers },
    );
  if (!contact)
    return NextResponse.json(
      { error: "פניית צור הקשר לא נמצאה" },
      { status: 404, headers },
    );
  const { version, ...fields } = parsed.data;
  const record = {
    ...fields,
    version: version + 1,
    updated_at: new Date().toISOString(),
  };
  const result =
    version === 0
      ? await client
          .from("contact_lead_followup")
          .insert({ contact_lead_id: id, ...record })
          .select("status,assignee,follow_up_at,internal_note,version")
          .single()
      : await client
          .from("contact_lead_followup")
          .update(record)
          .eq("contact_lead_id", id)
          .eq("version", version)
          .select("status,assignee,follow_up_at,internal_note,version")
          .maybeSingle();
  if (result.error?.code === "23505" || (!result.error && !result.data))
    return NextResponse.json(
      {
        error:
          "הפנייה עודכנה במכשיר אחר. הפרטים שהקלדת נשארו כאן; טענו מחדש לפני שמירה נוספת.",
      },
      { status: 409, headers },
    );
  if (result.error)
    return NextResponse.json(
      { error: "לא הצלחנו לשמור את פרטי הטיפול. נסו שוב." },
      { status: 503, headers },
    );
  return NextResponse.json({ data: result.data }, { headers });
}
