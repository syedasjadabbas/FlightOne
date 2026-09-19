"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { formatMinor } from "@/lib/bookings/checkoutDisplay";
import type { Companion } from "@/lib/api/profile.api";
import {
  validateTravellerFormData,
  type TravellerFormData,
} from "@/lib/bookings/travellerAutoFill";

export type PaymentMethodOption =
  | "card"
  | "corporate_credit"
  | "jazzcash"
  | "easypaisa"
  | "onelink_ibft";

export type QuotedProgressionStep = "TRAVELLER" | "PAYMENT";

export function CheckoutQuotedActions({
  formData,
  setFormData,
  savedCompanions = [],
  onSelectPrimary,
  onSelectCompanion,
  paymentToken,
  setPaymentToken,
  accountNumber = "",
  setAccountNumber,
  payMethod,
  setPayMethod,
  busy,
  checkoutBlockedByPriceChange,
  corporateBlocked,
  canCapture,
  paying,
  reserving,
  onPay,
  onReserve,
  amountMinor = 0,
  currency = "PKR",
  quotedStep = "TRAVELLER",
  onContinueToCheckout,
  onBackToTraveller,
}: {
  formData: TravellerFormData;
  setFormData: React.Dispatch<React.SetStateAction<TravellerFormData>>;
  savedCompanions?: Companion[];
  onSelectPrimary: () => void;
  onSelectCompanion: (companion: Companion) => void;
  paymentToken: string;
  setPaymentToken: (v: string) => void;
  accountNumber?: string;
  setAccountNumber?: (v: string) => void;
  payMethod: PaymentMethodOption;
  setPayMethod?: (v: PaymentMethodOption) => void;
  busy: boolean;
  checkoutBlockedByPriceChange: boolean;
  corporateBlocked: boolean;
  canCapture: boolean;
  paying: boolean;
  reserving: boolean;
  onPay: () => void;
  onReserve: () => void;
  amountMinor?: number;
  currency?: string;
  quotedStep?: QuotedProgressionStep;
  onContinueToCheckout?: () => void;
  onBackToTraveller?: () => void;
}) {
  const hasCompanions = savedCompanions.length > 0;
  const [saveProfileInfo, setSaveProfileInfo] = useState(true);
  const [saveCard, setSaveCard] = useState(true);
  const [isPassengerOpen, setIsPassengerOpen] = useState(true);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isSpecialReqOpen, setIsSpecialReqOpen] = useState(false);
  const [mealPref, setMealPref] = useState("standard");
  const [seatPref, setSeatPref] = useState("any");
  const [specialNotes, setSpecialNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const formattedPayAmount = amountMinor > 0 ? formatMinor(amountMinor, currency) : "";

  return (
    <div className="flex flex-col gap-6">
      {/* ── STEP 1: TRAVELLER & PASSENGER DETAILS CARD ───── */}
      {quotedStep === "TRAVELLER" ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs transition-shadow hover:shadow-sm">
          {/* Card Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="text-[17px] font-bold tracking-tight text-slate-900">
                  Traveller & Passenger Details
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                  These details will be used for your ticket issuance. Make sure they match your travel documents.
                </p>
              </div>
            </div>

            {formData.isAutoFilled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-800 border border-cyan-200/60 shadow-2xs">
                <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Auto-filled from {formData.sourceLabel || "Profile & Vault"}
              </span>
            ) : null}
          </div>

          {/* Companion Switcher */}
          {hasCompanions ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50/80 p-2 border border-slate-100">
              <span className="text-[12px] font-medium text-slate-500 pl-1">Select Profile:</span>
              <button
                type="button"
                disabled={busy || checkoutBlockedByPriceChange}
                onClick={onSelectPrimary}
                className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-all ${
                  !formData.companionId
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Primary (Self)
              </button>
              {savedCompanions.map((comp) => (
                <button
                  key={comp.id}
                  type="button"
                  disabled={busy || checkoutBlockedByPriceChange}
                  onClick={() => onSelectCompanion(comp)}
                  className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-all ${
                    formData.companionId === comp.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {comp.fullName}
                  {comp.relationship ? ` (${comp.relationship})` : ""}
                </button>
              ))}
            </div>
          ) : null}

          {/* Passenger 1 Box */}
          <div className="mt-5 rounded-xl border border-slate-200/90 bg-slate-50/30 overflow-hidden">
            {/* Passenger Box Header */}
            <button
              type="button"
              onClick={() => setIsPassengerOpen((v) => !v)}
              className="flex w-full items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
                  1
                </div>
                <div>
                  <span className="text-[13px] font-bold text-slate-900">Passenger 1 (Adult)</span>
                  <span className="text-[11px] text-slate-500 ml-2 font-medium">Primary traveller</span>
                </div>
              </div>
              <svg
                className={`h-4 w-4 text-slate-500 transition-transform ${isPassengerOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isPassengerOpen ? (
              <div className="p-4 sm:p-5 space-y-4 bg-white">
                {/* Form Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Given name *"
                    value={formData.givenName}
                    onChange={(e) => {
                      setValidationError(null);
                      setFormData((prev) => ({ ...prev, givenName: e.target.value }));
                    }}
                    placeholder="First / Given names"
                    disabled={busy || checkoutBlockedByPriceChange}
                    required
                  />
                  <Input
                    label="Surname *"
                    value={formData.surname}
                    onChange={(e) => {
                      setValidationError(null);
                      setFormData((prev) => ({ ...prev, surname: e.target.value }));
                    }}
                    placeholder="Last / Family name"
                    disabled={busy || checkoutBlockedByPriceChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                      Nationality *
                    </label>
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={(e) => {
                        setValidationError(null);
                        setFormData((prev) => ({
                          ...prev,
                          nationality: e.target.value.toUpperCase().slice(0, 3),
                        }));
                      }}
                      placeholder="e.g. PK (Pakistan), US, GB"
                      disabled={busy || checkoutBlockedByPriceChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                    />
                  </div>

                  <Input
                    label="Date of birth *"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => {
                      setValidationError(null);
                      setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                    }}
                    disabled={busy || checkoutBlockedByPriceChange}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Passport number *"
                    value={formData.passportNumber}
                    onChange={(e) => {
                      setValidationError(null);
                      setFormData((prev) => ({
                        ...prev,
                        passportNumber: e.target.value.toUpperCase(),
                      }));
                    }}
                    placeholder="Passport / Document ID"
                    disabled={busy || checkoutBlockedByPriceChange}
                  />
                  <Input
                    label="Passport expiry date *"
                    type="date"
                    value={formData.passportExpiry}
                    onChange={(e) => {
                      setValidationError(null);
                      setFormData((prev) => ({ ...prev, passportExpiry: e.target.value }));
                    }}
                    disabled={busy || checkoutBlockedByPriceChange}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Phone number *"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setValidationError(null);
                      setFormData((prev) => ({ ...prev, phone: e.target.value }));
                    }}
                    placeholder="+92 300 1234567"
                    disabled={busy || checkoutBlockedByPriceChange}
                  />
                  <Input
                    label="Email address *"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setValidationError(null);
                      setFormData((prev) => ({ ...prev, email: e.target.value }));
                    }}
                    placeholder="traveller@example.com"
                    disabled={busy || checkoutBlockedByPriceChange}
                  />
                </div>

                {/* Checkbox Save Info */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveProfileInfo}
                      onChange={(e) => setSaveProfileInfo(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-[13px] font-medium text-slate-800">
                        Save this information to my profile for faster booking next time
                      </span>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Your data is encrypted and stored securely
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          {/* ── COLLAPSIBLE SECTIONS ─────────────────────────── */}
          <div className="mt-4 space-y-3">
            {/* Section 1: Contact Information */}
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setIsContactOpen((v) => !v)}
                className="flex w-full items-center justify-between p-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-slate-900">Contact Information</h4>
                    <p className="text-[11px] text-slate-500">For booking updates and travel notifications</p>
                  </div>
                </div>
                <svg
                  className={`h-4 w-4 text-slate-400 transition-transform ${isContactOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isContactOpen ? (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3 text-[12px] text-slate-600">
                  <p>
                    Flight status updates, gate changes, and e-tickets will be delivered to{" "}
                    <strong className="text-slate-900">{formData.email || "your email"}</strong> and via SMS to{" "}
                    <strong className="text-slate-900">{formData.phone || "your phone number"}</strong>.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    You can update notification channels anytime in Profile & Journey Watch.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Section 2: Special Requests */}
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSpecialReqOpen((v) => !v)}
                className="flex w-full items-center justify-between p-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="1" y1="14" x2="7" y2="14" />
                      <line x1="9" y1="8" x2="15" y2="8" />
                      <line x1="17" y1="16" x2="23" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-slate-900">Special Requests (Optional)</h4>
                    <p className="text-[11px] text-slate-500">Seats, meals, assistance and more</p>
                  </div>
                </div>
                <svg
                  className={`h-4 w-4 text-slate-400 transition-transform ${isSpecialReqOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isSpecialReqOpen ? (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Meal Preference
                      </label>
                      <select
                        value={mealPref}
                        onChange={(e) => setMealPref(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 focus:border-blue-600 outline-none"
                      >
                        <option value="standard">Standard Airline Meal</option>
                        <option value="halal">Halal Meal (MOML)</option>
                        <option value="vegetarian">Vegetarian Meal (VGML)</option>
                        <option value="diabetic">Diabetic Meal (DBML)</option>
                        <option value="child">Child Meal (CHML)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Seat Preference
                      </label>
                      <select
                        value={seatPref}
                        onChange={(e) => setSeatPref(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 focus:border-blue-600 outline-none"
                      >
                        <option value="any">No Preference</option>
                        <option value="window">Window Seat</option>
                        <option value="aisle">Aisle Seat</option>
                        <option value="extra_legroom">Extra Legroom (Subject to airline)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Special Assistance Notes
                    </label>
                    <input
                      type="text"
                      value={specialNotes}
                      onChange={(e) => setSpecialNotes(e.target.value)}
                      placeholder="e.g. Wheelchair assistance, medical equipment"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Validation error message if any */}
          {validationError ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[12px] text-rose-700 font-medium flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{validationError}</span>
            </div>
          ) : null}

          {/* Explicit "Continue to Checkout" Progression Button */}
          <div className="mt-6 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              Please review passenger details before continuing to payment.
            </p>
            <Button
              type="button"
              className="w-full sm:w-auto min-w-[220px] py-3.5 text-[14px] font-bold shadow-md transition-transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              disabled={busy || checkoutBlockedByPriceChange}
              onClick={() => {
                const validation = validateTravellerFormData(formData);
                if (!validation.isValid) {
                  setValidationError("Given name and surname are required to proceed to checkout");
                  return;
                }
                setValidationError(null);
                onContinueToCheckout?.();
              }}
            >
              <span>Continue to Checkout</span>
              <span aria-hidden="true">→</span>
            </Button>
          </div>
        </div>
      ) : (
        /* ── STEP 2: PAYMENT METHOD CARD ──────────────────── */
        <div className="space-y-6">
          {/* Passenger Summary Chip when in Payment Step */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-slate-900">
                    {formData.givenName} {formData.surname}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-semibold text-emerald-800">
                    ✓ Passenger details verified
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {formData.nationality ? `Nationality: ${formData.nationality}` : "PK"}
                  {formData.passportNumber ? ` · Passport: ${formData.passportNumber}` : ""}
                  {formData.phone ? ` · ${formData.phone}` : ""}
                </p>
              </div>
            </div>
            {onBackToTraveller ? (
              <button
                type="button"
                onClick={onBackToTraveller}
                className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>←</span>
                <span>Edit Passenger Details</span>
              </button>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <div>
                <h2 className="text-[17px] font-bold tracking-tight text-slate-900">Payment Method</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Choose your preferred payment method to complete this booking.
                </p>
              </div>
            </div>

            {/* Selectable Payment Method Cards */}
            {setPayMethod ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Card */}
                <button
                  type="button"
                  disabled={busy || corporateBlocked}
                  onClick={() => setPayMethod("card")}
                  className={`flex flex-col items-center text-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                    payMethod === "card"
                      ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100/70 text-blue-700 mb-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
      </div>
    </div>
  );
}

export function CheckoutReservedActions({
  busy,
  canTicket,
  hasPayment,
  pendingPaymentDetails,
  checkoutBlockedByPriceChange,
  corporateBlocked = false,
  payMethod,
  setPayMethod,
  paymentToken,
  setPaymentToken,
  accountNumber = "",
  setAccountNumber,
  canCapture,
  paying,
  ticketing,
  onPay,
  onTicket,
  amountMinor = 0,
  currency = "PKR",
}: {
  busy: boolean;
  canTicket: boolean;
  hasPayment: boolean;
  pendingPaymentDetails?: Record<string, any> | null;
  checkoutBlockedByPriceChange: boolean;
  corporateBlocked?: boolean;
  payMethod: PaymentMethodOption;
  setPayMethod?: (v: PaymentMethodOption) => void;
  paymentToken: string;
  setPaymentToken: (v: string) => void;
  accountNumber?: string;
  setAccountNumber?: (v: string) => void;
  canCapture: boolean;
  paying: boolean;
  ticketing: boolean;
  onPay: () => void;
  onTicket: () => void;
  amountMinor?: number;
  currency?: string;
}) {
  const isPending1Link = Boolean(pendingPaymentDetails?.consumerNumber);
  const formattedPayAmount = amountMinor > 0 ? formatMinor(amountMinor, currency) : "";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[17px] font-bold text-slate-900">
            {hasPayment
              ? "Supplier Reservation & Ticketing"
              : isPending1Link
                ? "1Link IBFT Clearance Pending"
                : "Payment for Reserved Hold"}
          </h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {hasPayment
              ? "Payment is authorized. Proceed to issue your ticket."
              : isPending1Link
                ? "Your seat is held. Complete bank transfer to confirm ticket."
                : "Your seat is held with the supplier. Complete payment to issue your ticket."}
          </p>
        </div>

        {hasPayment ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Payment confirmed
          </span>
        ) : isPending1Link ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
            ⏳ Awaiting bank clearance
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 border border-amber-200">
            Payment required
          </span>
        )}
      </div>

      {isPending1Link ? (
        <div className="mt-5 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-900">1Bill Consumer Number:</span>
            <span className="font-mono text-[15px] font-bold text-white bg-blue-800 px-3 py-1 rounded-md shadow-2xs">
              {pendingPaymentDetails?.consumerNumber}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] pt-2 border-t border-blue-200/60">
            <div>
              <span className="text-slate-500">Bank:</span> {pendingPaymentDetails?.bankName}
            </div>
            <div>
              <span className="text-slate-500">Account Title:</span> {pendingPaymentDetails?.accountTitle}
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500">IBAN:</span>{" "}
              <span className="font-mono font-semibold text-slate-900">{pendingPaymentDetails?.iban}</span>
            </div>
          </div>
          <p className="text-[12px] text-blue-800/90 pt-1">
            Your seat is reserved in hold. As soon as your bank confirms the 1Bill or IBFT transfer, your ticket will be issued automatically.
          </p>
        </div>
      ) : null}

      {!hasPayment && !isPending1Link ? (
        <div className="mt-5 space-y-4">
          {setPayMethod ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                disabled={busy || corporateBlocked}
                onClick={() => setPayMethod("card")}
                className={`rounded-xl p-2.5 text-[12px] font-bold border transition-all ${
                  payMethod === "card"
                    ? "border-blue-600 bg-blue-50/40 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                💳 Card
              </button>
              <button
                type="button"
                disabled={busy || corporateBlocked}
                onClick={() => setPayMethod("jazzcash")}
                className={`rounded-xl p-2.5 text-[12px] font-bold border transition-all ${
                  payMethod === "jazzcash"
                    ? "border-amber-600 bg-amber-50/40 text-amber-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                📱 JazzCash
              </button>
              <button
                type="button"
                disabled={busy || corporateBlocked}
                onClick={() => setPayMethod("easypaisa")}
                className={`rounded-xl p-2.5 text-[12px] font-bold border transition-all ${
                  payMethod === "easypaisa"
                    ? "border-emerald-600 bg-emerald-50/40 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                📱 Easypaisa
              </button>
              <button
                type="button"
                disabled={busy || corporateBlocked}
                onClick={() => setPayMethod("onelink_ibft")}
                className={`rounded-xl p-2.5 text-[12px] font-bold border transition-all ${
                  payMethod === "onelink_ibft"
                    ? "border-blue-800 bg-blue-50/40 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                🏛️ 1Link IBFT
              </button>
            </div>
          ) : null}

          {payMethod === "card" ? (
            <Input
              label="Card number / token *"
              value={paymentToken}
              onChange={(e) => setPaymentToken(e.target.value)}
              placeholder="pm_… (tokenized)"
              disabled={busy || !canCapture || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "jazzcash" ? (
            <Input
              label="JazzCash Mobile Number *"
              value={accountNumber}
              onChange={(e) => setAccountNumber?.(e.target.value)}
              placeholder="03001234567"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "easypaisa" ? (
            <Input
              label="Easypaisa Mobile Number *"
              value={accountNumber}
              onChange={(e) => setAccountNumber?.(e.target.value)}
              placeholder="03451234567"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "onelink_ibft" ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-[12px] text-blue-900">
              Generates a 1Bill voucher number to complete your bank transfer before the hold expiration.
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full py-4 text-[15px] font-bold shadow-md"
            disabled={
              busy ||
              (!canCapture && payMethod === "card") ||
              checkoutBlockedByPriceChange ||
              corporateBlocked
            }
            onClick={onPay}
          >
            {paying ? "Processing payment…" : `Pay ${formattedPayAmount} to Issue Ticket →`}
          </Button>
        </div>
      ) : hasPayment ? (
        <div className="mt-5 space-y-3">
          <Button
            type="button"
            className="w-full py-4 text-[15px] font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={busy || !canTicket || checkoutBlockedByPriceChange}
            onClick={onTicket}
          >
            {ticketing ? "Ticketing in Progress…" : "Issue Ticket / Voucher →"}
          </Button>
          {!canTicket ? (
            <p className="text-[12px] text-slate-500 text-center">
              Ticketing stays blocked until the supplier can issue a live confirmed ticket.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
