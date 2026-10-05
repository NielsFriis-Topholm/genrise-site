// /api/lead.js — Genrise lead-funktion
// Sender kontaktformularen på genrise.com ind i GoHighLevel (kontakt, Brand = Genrise,
// tag brand-genrise, besked som note, opportunity i Sales Pipeline / Klar til kald).
// Er SLACK_WEBHOOK_URL sat, sendes leadet også til Slack som backup.
//
// Status (viser kun om miljøvariablerne er sat): https://genrise.com/api/lead

import { sendLeadToGHL, ghlConfigured } from "./_lib/ghl-lead.js";

const VERSION = "v1-ghl";
const clean = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function status() {
  return {
    GHL_API_TOKEN: clean(process.env.GHL_API_TOKEN) ? "ok" : "MANGLER",
    GHL_LOCATION_ID: clean(process.env.GHL_LOCATION_ID) || "MANGLER",
    SLACK_WEBHOOK_URL: clean(process.env.SLACK_WEBHOOK_URL) ? "ok" : "ikke sat (valgfri)",
  };
}

async function toGHL(lead) {
  const lines = [];
  if (lead.message) lines.push(lead.message);
  if (lead.website) lines.push(`Website: ${lead.website}`);
  if (lead.lang === "en") lines.push("Udfyldt på engelsk.");
  try {
    const r = await sendLeadToGHL({
      brand: "Genrise",
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      website: lead.website,
      message: lines.join("\n\n"),
      source: lead.source,
    });
    return { destination: "ghl", ok: true, response: `kontakt ${r.contactId}, opportunity ${r.opportunityId} (${r.createdOpportunity ? "ny" : "fandtes allerede"})` };
  } catch (err) {
    console.error("GHL sync fejlede", err);
    return { destination: "ghl", ok: false, response: String(err.message || err).slice(0, 300) };
  }
}

async function toSlack(lead) {
  try {
    const res = await fetch(clean(process.env.SLACK_WEBHOOK_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🎯 Nyt lead fra genrise.com\n*Navn:* ${lead.name}\n*Email:* ${lead.email}\n*Telefon:* ${lead.phone}\n*Virksomhed:* ${lead.company}\n*Website:* ${lead.website}\n*Besked:* ${lead.message}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return { destination: "slack", ok: res.ok, response: res.ok ? "ok" : `status ${res.status}` };
  } catch (err) {
    return { destination: "slack", ok: false, response: String(err) };
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ service: "genrise lead endpoint", deployed_version: VERSION, env: status() });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let data = req.body;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  data = data || {};

  // Honeypot: skjult felt, som kun bots udfylder. Svar "ok", men send intet videre.
  if (clean(data.company_website_hp)) {
    console.log("Lead afvist af honeypot");
    return res.status(200).json({ ok: true });
  }

  const lead = {
    name: clean(data.name, 200),
    email: clean(data.email, 200),
    phone: clean(data.phone, 50),
    company: clean(data.company, 200),
    website: clean(data.website, 300),
    message: clean(data.message),
    lang: data.lang === "en" ? "en" : "da",
    source: "genrise.com/kontakt",
  };

  if (!lead.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return res.status(400).json({ error: "Navn og gyldig e-mail er påkrævet" });
  }

  const jobs = [];
  if (ghlConfigured()) jobs.push(toGHL(lead));
  if (clean(process.env.SLACK_WEBHOOK_URL)) jobs.push(toSlack(lead));
  if (!jobs.length) {
    console.error("Ingen destinationer konfigureret", status());
    return res.status(500).json({ error: "Ingen destinationer er konfigureret" });
  }

  const delivery = await Promise.all(jobs);
  delivery.forEach((d) => console.log(`Lead delivery: ${d.destination} → ${d.ok ? "OK" : "FAILED"} ${d.ok ? "" : d.response}`));
  const ok = delivery.some((d) => d.ok);
  // Detaljer (kontakt-ID'er m.m.) vises ikke til den besøgende, kun i Vercel-loggen.
  return res.status(ok ? 200 : 502).json({ ok });
}
