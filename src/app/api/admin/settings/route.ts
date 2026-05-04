// audit-skip: writes to admin_audit_log (mig 079) — parallel audit system, no double-write
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  loadAdminSettings,
  updateAdminSetting,
  InvalidSettingKeyError,
  InvalidSettingValueError,
} from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/auth/require-admin";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  try {
    const supabase = getAdminClient();
    const settings = await loadAdminSettings(supabase);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[api/admin/settings] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: "Missing required field: key" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const result = await updateAdminSetting(supabase, key, value, null);
    return NextResponse.json({ ok: true, previousValue: result.previousValue });
  } catch (error) {
    if (error instanceof InvalidSettingKeyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof InvalidSettingValueError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/admin/settings] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
  }
}
