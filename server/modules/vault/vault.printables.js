/**
 * Minimal PDF builder for Module 07 printable tickets/vouchers.
 * Zero native deps. Never invents booking facts.
 */

function escapePdfText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

/**
 * @param {{ title: string, lines: string[] }} doc
 * @returns {Buffer}
 */
export function buildSimplePdf({ title, lines }) {
  const safeTitle = escapePdfText(title).slice(0, 120);
  const contentLines = [
    "BT",
    "/F1 16 Tf",
    "50 780 Td",
    `(${safeTitle}) Tj`,
    "0 -28 Td",
    "/F1 11 Tf",
  ];

  const body = (Array.isArray(lines) ? lines : [])
    .map((l) => String(l ?? "").slice(0, 110))
    .filter((l) => l.trim().length > 0)
    .slice(0, 40);

  for (let i = 0; i < body.length; i += 1) {
    if (i > 0) contentLines.push("0 -16 Td");
    contentLines.push(`(${escapePdfText(body[i])}) Tj`);
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function travellerName(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const full = snapshot.fullName || snapshot.name;
  if (full) return String(full);
  const given = snapshot.givenName || snapshot.firstName;
  const sur = snapshot.surname || snapshot.lastName;
  if (given || sur) return [given, sur].filter(Boolean).join(" ");
  return null;
}

function formatMoney(amountMinor, currency) {
  if (amountMinor == null || !currency) return null;
  if (!Number.isFinite(Number(amountMinor))) return null;
  return `${currency} ${(Number(amountMinor) / 100).toFixed(2)}`;
}

/**
 * @param {'TICKET'|'HOTEL_VOUCHER'} kind
 * @returns {{ kind: string, title: string, filename: string, buffer: Buffer, meta: object }|null}
 */
export function buildBookingPrintable(kind, {
  product,
  bookingId,
  externalRef,
  ticketNumbers,
  voucherRefs,
  travellerSnapshot,
  currency,
  amountMinor,
  issuedAt,
}) {
  const tickets = Array.isArray(ticketNumbers)
    ? ticketNumbers.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const vouchers = Array.isArray(voucherRefs)
    ? voucherRefs.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const ref = externalRef ? String(externalRef).trim() : "";

  if (kind === "TICKET" && !ref && tickets.length === 0) return null;
  if (kind === "HOTEL_VOUCHER" && !ref && vouchers.length === 0) return null;

  const title = kind === "TICKET" ? "FlightOne — E-Ticket" : "FlightOne — Hotel Voucher";
  const lines = [
    `Document: ${kind === "TICKET" ? "E-Ticket" : "Hotel voucher"}`,
    `Booking id: ${bookingId}`,
    product ? `Product: ${product}` : null,
    ref ? `Confirmation / PNR: ${ref}` : null,
    tickets.length ? `Ticket number(s): ${tickets.join(", ")}` : null,
    vouchers.length ? `Voucher ref(s): ${vouchers.join(", ")}` : null,
    travellerName(travellerSnapshot)
      ? `Traveller: ${travellerName(travellerSnapshot)}`
      : null,
    formatMoney(amountMinor, currency)
      ? `Amount: ${formatMoney(amountMinor, currency)}`
      : null,
    `Issued: ${issuedAt || new Date().toISOString()}`,
    "Generated from confirmed supplier data only.",
  ].filter(Boolean);

  const filename =
    kind === "TICKET" ? `ticket-${bookingId}.pdf` : `voucher-${bookingId}.pdf`;

  return {
    kind,
    title,
    filename,
    buffer: buildSimplePdf({ title, lines }),
    meta: {
      printable: true,
      bookingId,
      product: product ?? null,
      externalRef: ref || null,
      ticketNumbers: tickets.length ? tickets : null,
      voucherRefs: vouchers.length ? vouchers : null,
      issuedAt: issuedAt || new Date().toISOString(),
    },
  };
}
