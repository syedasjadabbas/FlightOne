/**
 * Live conversational intelligence checks against /api/chat
 */
const LOCATION = {
  city: "Lahore",
  place: "Lahore",
  country: "Pakistan",
  countryCode: "PK",
  iata: "LHE",
  currency: "PKR",
  source: "default",
};

async function turn(message, history, previousTravelPlan) {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      location: LOCATION,
      previousTravelPlan,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function q(plan) {
  if (!plan) return null;
  if (plan.action === "search") {
    return plan.searches?.find((s) => s.product === "FLIGHT")?.query ?? null;
  }
  if (plan.action === "clarify" && plan.draft) {
    return plan.draft.searches?.find((s) => s.product === "FLIGHT")?.query ?? null;
  }
  return null;
}

function assert(name, cond, detail = "") {
  if (cond) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

async function main() {
  // TEST 1: complete one-way → search immediately
  {
    const d = await turn(
      "I want to fly from Lahore to Dubai on September 10, 2026.",
      [],
      null,
    );
    const plan = d.meta?.travelPlan;
    const query = q(plan);
    console.log("\nT1 reply:", d.reply?.slice(0, 120));
    assert("T1 searches or shows results", plan?.action === "search" || (d.searchPanel?.offers?.length ?? 0) > 0, plan?.action);
    assert("T1 LHE-DXB-2026-09-10", query?.origin === "LHE" && query?.destination === "DXB" && query?.departureDate === "2026-09-10", JSON.stringify(query));
    assert("T1 does not ask origin/dest/date", !/where would you like|what date|when would you like to fly/i.test(d.reply || ""));
  }

  // TEST 2: Istanbul weekend → ask date only
  {
    const h = [];
    const t1 = await turn(
      "Weekend trip to Istanbul from Lahore — flights and hotel",
      h,
      null,
    );
    console.log("\nT2a reply:", t1.reply);
    const p1 = t1.meta?.travelPlan;
    const q1 = q(p1);
    assert("T2a clarify or search", p1?.action === "clarify" || p1?.action === "search", p1?.action);
    assert("T2a route LHE-IST", q1?.origin === "LHE" && q1?.destination === "IST", JSON.stringify(q1));
    if (p1?.action === "clarify") {
      assert("T2a asks date not origin", /date|depart/i.test(t1.reply || "") && !/where are you flying from/i.test(t1.reply || ""));
    }

    h.push({ role: "user", content: "Weekend trip to Istanbul from Lahore — flights and hotel" });
    h.push({ role: "assistant", content: t1.reply });

    const t2 = await turn("11th of sept", h, p1);
    console.log("T2b reply:", t2.reply?.slice(0, 140));
    const p2 = t2.meta?.travelPlan;
    const q2 = q(p2);
    assert("T2b has departure 2026-09-11", q2?.departureDate === "2026-09-11", JSON.stringify(q2));
    assert("T2b not looping original fly ask", !/^when would you like to fly from lhe to ist\??$/i.test((t2.reply || "").trim()));
  }

  // TEST 3: Karachi Dubai → date → search
  {
    const h = [];
    const t1 = await turn("I want to fly from Karachi to Dubai.", h, null);
    console.log("\nT3a reply:", t1.reply);
    const p1 = t1.meta?.travelPlan;
    assert("T3a clarify date", p1?.action === "clarify" && /date|depart/i.test(t1.reply || ""), t1.reply);
    h.push({ role: "user", content: "I want to fly from Karachi to Dubai." });
    h.push({ role: "assistant", content: t1.reply });
    const t2 = await turn("September 10", h, p1);
    console.log("T3b reply:", t2.reply?.slice(0, 140));
    const q2 = q(t2.meta?.travelPlan);
    assert("T3b departure filled", q2?.departureDate === "2026-09-10", JSON.stringify(q2));
    assert("T3b KHI-DXB", q2?.origin === "KHI" && q2?.destination === "DXB", JSON.stringify(q2));
  }

  console.log("\nDone. exit=", process.exitCode || 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
