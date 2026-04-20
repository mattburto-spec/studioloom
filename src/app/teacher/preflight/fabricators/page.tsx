/**
 * /teacher/preflight/fabricators — Fabricator admin.
 *
 * Server component: fetches the current teacher's fabricators + machine
 * assignments, plus the list of machine profiles the teacher can assign
 * (system templates + their own). Passes both to a client wrapper that
 * renders the table, Invite modal, and row actions.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import FabricatorsClient from "./FabricatorsClient";

// The teacher layout (src/app/teacher/layout.tsx) is a client component
// that handles auth redirection to /teacher/login. We don't issue a
// server-side redirect() here because combining it with the layout's
// client useEffect auth check crashes hydration. When teacherId is null,
// we render an empty shell that the client layout replaces with a redirect.

export const dynamic = "force-dynamic";

async function getCurrentTeacherId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

interface MachineProfile {
  id: string;
  name: string;
  machine_category: string;
}

interface FabricatorView {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  invite_pending: boolean;
  machines: MachineProfile[];
}

const INVITE_PENDING = "INVITE_PENDING";

export default async function FabricatorsPage() {
  const teacherId = await getCurrentTeacherId();
  if (!teacherId) {
    // Client teacher layout will redirect to /teacher/login before this shell
    // is visible. Rendering an empty container avoids the server-redirect +
    // client-layout-redirect hydration conflict.
    return <div className="min-h-screen" />;
  }

  const admin = createAdminClient();

  // Fabricators invited by this teacher.
  const { data: fabRows } = await admin
    .from("fabricators")
    .select("id, email, display_name, is_active, created_at, last_login_at, password_hash")
    .eq("invited_by_teacher_id", teacherId)
    .order("created_at", { ascending: false });

  const fabIds = (fabRows ?? []).map((f) => f.id);
  const { data: machineLinks } = fabIds.length
    ? await admin
        .from("fabricator_machines")
        .select("fabricator_id, machine_profiles(id, name, machine_category)")
        .in("fabricator_id", fabIds)
    : { data: [] };

  type Link = {
    fabricator_id: string;
    // Supabase nested select returns arrays
    machine_profiles: MachineProfile[];
  };
  const byFab = new Map<string, MachineProfile[]>();
  for (const link of (machineLinks ?? []) as unknown as Link[]) {
    const mps = Array.isArray(link.machine_profiles) ? link.machine_profiles : [link.machine_profiles];
    const list = byFab.get(link.fabricator_id) ?? [];
    for (const mp of mps) {
      if (mp) list.push(mp);
    }
    byFab.set(link.fabricator_id, list);
  }

  const fabricators: FabricatorView[] = (fabRows ?? []).map((f) => ({
    id: f.id,
    email: f.email,
    display_name: f.display_name,
    is_active: f.is_active,
    created_at: f.created_at,
    last_login_at: f.last_login_at,
    invite_pending: f.password_hash === INVITE_PENDING,
    machines: byFab.get(f.id) ?? [],
  }));

  // Machine profiles the teacher can assign — system templates + own.
  const { data: availableMachines } = await admin
    .from("machine_profiles")
    .select("id, name, machine_category, is_system_template, teacher_id")
    .or(`is_system_template.eq.true,teacher_id.eq.${teacherId}`)
    .order("name", { ascending: true });

  const machines: MachineProfile[] = (availableMachines ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    machine_category: m.machine_category,
  }));

  return <FabricatorsClient initialFabricators={fabricators} machines={machines} />;
}
