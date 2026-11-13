// منصة A9: إرسال إشعارات الرسائل (Web Push)
// تستدعيها القاعدة (pg_net) من توصل رسالة جديدة.
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC = "BND0Pvsc6I3AGxAjn52fpjdzoXOCpp9Z5Sii5uaOEQB1A3nrj-Vov4M8QbnDNoUTuHU88qYPYl0d6Ov5OFhBhV8";
const VAPID_PRIVATE = "<VAPID private key, kept only in the deployed function>";
const HOOK_SECRET = "<hook secret, kept only in the deployed function and private.settings>";

webpush.setVapidDetails("https://zaid004.github.io/a9/", VAPID_PUBLIC, VAPID_PRIVATE);

type Sub = { endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" || req.headers.get("x-a9-hook") !== HOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const { subs, payload } = await req.json() as { subs: Sub[]; payload: unknown };
  const gone: string[] = [];
  let sent = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24, urgency: "high" },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
    }
  }));
  if (gone.length) {
    await fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/rpc/a9_push_gone", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
      body: JSON.stringify({ p_hook: HOOK_SECRET, p_endpoints: gone }),
    }).catch(() => {});
  }
  return new Response(JSON.stringify({ sent, gone: gone.length }), { headers: { "Content-Type": "application/json" } });
});
