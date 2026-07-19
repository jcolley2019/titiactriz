import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Minimal typed wrapper for Supabase Auth OAuth 2.1 authorization-server methods
// (beta namespace not always visible in generated types).
type OAuthClient = {
  name?: string;
  logo?: string;
  redirect_uri?: string;
};
type OAuthDetails = {
  client?: OAuthClient;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { redirect_url?: string; redirect_to?: string };
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/admin?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 pt-32 pb-16 text-foreground">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-2xl mb-3">Authorization error</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 pt-32 pb-16 text-foreground">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "an application";

  return (
    <main className="min-h-screen flex items-center justify-center px-6 pt-32 pb-16 text-foreground">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-8 shadow-[var(--shadow-card)]">
        <h1 className="font-serif text-2xl mb-2">Connect {clientName}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This will let <strong>{clientName}</strong> access the Cristyna Polentino site tools as you.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 h-10 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 h-10 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
