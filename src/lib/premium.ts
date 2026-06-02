import { useEffect } from "react";
import { getSupabase, initSupabase } from "./supabase";
import { useAuth } from "./auth";
import { updateProfile, useDb } from "./habits";

/**
 * Email-based Pro approval.
 *
 * Payment is disabled, so Pro is granted by adding a user's email to the
 * `premium_access` table in Supabase. Returns:
 *   - true  -> the signed-in email is approved for Pro
 *   - false -> definitively not approved
 *   - null  -> couldn't determine (offline / not configured); caller should
 *              leave the existing grant untouched so offline users keep Pro.
 */
export async function checkPremiumApproval(
  email: string | null | undefined,
): Promise<boolean | null> {
  const sb = (await initSupabase()) ?? getSupabase();
  if (!sb || !email) return null;
  const { data, error } = await sb
    .from("premium_access")
    .select("approved")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) return null;
  return Boolean(data?.approved);
}

/**
 * Keeps the local `cloudPremium` flag in sync with the user's approval status.
 * Mount once near the app root.
 */
export function usePremiumApprovalSync() {
  const auth = useAuth();
  const db = useDb();
  const email = auth.user?.email ?? null;
  const cloudPremium = db.profile.cloudPremium;

  useEffect(() => {
    if (auth.status !== "ready") return;

    // Signed out -> no cloud grant. (Immediate, no network needed.)
    if (!email) {
      if (cloudPremium) updateProfile({ cloudPremium: false });
      return;
    }

    let cancelled = false;
    void checkPremiumApproval(email).then((approved) => {
      if (cancelled || approved === null) return;
      if (approved !== cloudPremium) updateProfile({ cloudPremium: approved });
    });
    return () => {
      cancelled = true;
    };
  }, [email, auth.status, cloudPremium]);
}
