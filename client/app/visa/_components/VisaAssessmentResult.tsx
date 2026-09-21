"use client";

import { ArrowRight } from "lucide-react";
import { TravellerChip, TravellerSection } from "@/app/components/traveller";
import type { VisaAssessment } from "@/lib/api/visa.api";
import { VisaChecklist } from "./VisaChecklist";
import { categoryLabel, categoryTone, formatEmbassyKey } from "./visaContent";

export function VisaAssessmentResult({
  assessment,
  destination,
  nationalityFallback,
}: {
  assessment: VisaAssessment;
  destination: string;
  nationalityFallback: string;
}) {
  const req = assessment.requirement;
  const nationality = assessment.traveller?.nationality ?? nationalityFallback ?? "—";
  const category = req?.category || assessment.requirement?.category;
  const isFact = Boolean(assessment.isFact);
  const dataStatus = req?.dataStatus ?? assessment.status;

  return (
    <>
      <TravellerSection title="Evaluation">
        <div className="fo-visa__corridor">
          <div className="fo-visa__corridor-route" aria-label="Passport route">
            <div className="fo-visa__endpoint">
              <p className="fo-visa__iso">{nationality || "—"}</p>
              <p className="fo-visa__iso-label">Passport</p>
            </div>
            <div className="fo-visa__corridor-mid" aria-hidden="true">
              <span className="fo-visa__corridor-line" />
              <ArrowRight size={16} />
              <span className="fo-visa__corridor-line" />
            </div>
            <div className="fo-visa__endpoint fo-visa__endpoint--arrive">
              <p className="fo-visa__iso">{destination}</p>
              <p className="fo-visa__iso-label">Destination</p>
            </div>
          </div>

          <div className="fo-visa__status-row">
            <TravellerChip tone={categoryTone(category)}>{categoryLabel(category)}</TravellerChip>
            <TravellerChip tone={isFact ? "default" : "warn"}>
              {isFact ? "Attributed fact" : "Guidance only"}
            </TravellerChip>
            {dataStatus ? <p className="fo-visa__status-note">{dataStatus}</p> : null}
          </div>

          <p className="fo-visa__summary">{assessment.avaSummary}</p>

          <dl className="fo-traveller__facts">
            <div className="fo-traveller__fact">
              <dt>Nationality</dt>
              <dd>{nationality || "—"}</dd>
            </div>
            <div className="fo-traveller__fact">
              <dt>Destination</dt>
              <dd>{destination}</dd>
            </div>
            <div className="fo-traveller__fact">
              <dt>Passport on file</dt>
              <dd>{assessment.traveller?.hasPassport ? "Verified in vault" : "Not uploaded"}</dd>
            </div>
            {req ? (
              <>
                <div className="fo-traveller__fact">
                  <dt>Category</dt>
                  <dd>{categoryLabel(req.category)}</dd>
                </div>
                <div className="fo-traveller__fact">
                  <dt>Data confidence</dt>
                  <dd>{req.dataStatus}</dd>
                </div>
                <div className="fo-traveller__fact">
                  <dt>Authority / source</dt>
                  <dd className="truncate">{req.source ?? "Consular database"}</dd>
                </div>
                {req.lastVerifiedAt ? (
                  <div className="fo-traveller__fact">
                    <dt>Last verified</dt>
                    <dd>{new Date(req.lastVerifiedAt).toLocaleDateString()}</dd>
                  </div>
                ) : null}
                {req.processingDaysMin != null || req.processingDaysMax != null ? (
                  <div className="fo-traveller__fact">
                    <dt>Processing</dt>
                    <dd>
                      {req.processingDaysMin ?? "?"}–{req.processingDaysMax ?? "?"} business days
                    </dd>
                  </div>
                ) : null}
                {assessment.traveller?.passportExpiry ? (
                  <div className="fo-traveller__fact">
                    <dt>Passport expiry</dt>
                    <dd>
                      {new Date(assessment.traveller.passportExpiry).toLocaleDateString()}
                      {assessment.traveller.passportExpiryStatus
                        ? ` (${assessment.traveller.passportExpiryStatus})`
                        : ""}
                    </dd>
                  </div>
                ) : null}
              </>
            ) : null}
            {assessment.missingInputs?.length ? (
              <div className="fo-traveller__fact">
                <dt>Additional inputs</dt>
                <dd>{assessment.missingInputs.join(", ")}</dd>
              </div>
            ) : null}
          </dl>

          {!assessment.isFact ? (
            <p className="fo-visa__guidance">
              Guidance from general catalog parameters — do not treat unverified data as an
              official travel guarantee.
            </p>
          ) : null}
        </div>
      </TravellerSection>

      {Array.isArray(req?.transit) && req.transit.length > 0 ? (
        <TravellerSection title="Transit & layover">
          <ul className="fo-traveller__list">
            {req.transit.map((t) => (
              <li key={t.destinationCode} className="fo-traveller__row">
                <div className="flex items-center justify-between gap-2">
                  <p className="fo-traveller__row-title">Transit via {t.destinationCode}</p>
                  <TravellerChip tone={categoryTone(t.category)}>
                    {categoryLabel(t.category)}
                  </TravellerChip>
                </div>
                <p className="fo-traveller__row-body">
                  {t.transitGuidance?.notes ||
                    t.transitNotes ||
                    "Airside transit may be allowed without a visa if you remain in the international zone under 24 hours."}
                </p>
                <p className="fo-traveller__row-meta">
                  {t.transitGuidance?.note ||
                    "Subject to terminal rules and airline baggage interlining."}
                </p>
              </li>
            ))}
          </ul>
        </TravellerSection>
      ) : null}

      {req?.embassyInfo && typeof req.embassyInfo === "object" ? (
        <TravellerSection title="Embassy & visa centre">
          <dl className="fo-traveller__facts">
            {Object.entries(req.embassyInfo as Record<string, unknown>).map(([k, v]) =>
              v == null || v === "" ? null : (
                <div key={k} className="fo-traveller__fact">
                  <dt>{formatEmbassyKey(k)}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ),
            )}
          </dl>
        </TravellerSection>
      ) : null}

      {Array.isArray(req?.requiredDocuments) && req.requiredDocuments.length > 0 ? (
        <TravellerSection title="Standard documents">
          <ul className="fo-visa__doc-list">
            {(req.requiredDocuments as unknown[]).map((d, i) => (
              <li key={i}>{typeof d === "string" ? d : JSON.stringify(d)}</li>
            ))}
          </ul>
        </TravellerSection>
      ) : null}

      {assessment.heldVisa && typeof assessment.heldVisa === "object" ? (
        <TravellerSection title="Visas on file">
          {(() => {
            const hv = assessment.heldVisa as {
              hasMatchingVisaOnFile?: boolean;
              expiresAt?: string | null;
              expiryStatus?: string | null;
              note?: string | null;
            };
            return (
              <dl className="fo-traveller__facts">
                <div className="fo-traveller__fact">
                  <dt>Matching visa in vault</dt>
                  <dd>{hv.hasMatchingVisaOnFile ? "Found on record" : "None on record"}</dd>
                </div>
                {hv.expiresAt ? (
                  <div className="fo-traveller__fact">
                    <dt>Valid until</dt>
                    <dd>
                      {new Date(hv.expiresAt).toLocaleDateString()}
                      {hv.expiryStatus ? ` (${hv.expiryStatus})` : ""}
                    </dd>
                  </div>
                ) : null}
                {hv.note ? <p className="fo-traveller__section-note">{hv.note}</p> : null}
              </dl>
            );
          })()}
        </TravellerSection>
      ) : null}

      <TravellerSection title="Document checklist">
        <VisaChecklist checklist={assessment.checklist} />
      </TravellerSection>
    </>
  );
}
