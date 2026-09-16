import { describe, expect, it } from "vitest";
import {
  buildTravellerSnapshot,
  formatDateForInput,
  resolveCompanionTraveller,
  resolvePrimaryTraveller,
  splitFullName,
  validateTravellerFormData,
  type TravellerFormData,
} from "./travellerAutoFill";
import type { Companion, IdentityDocument, TravellerProfile } from "@/lib/api/profile.api";

describe("travellerAutoFill", () => {
  describe("splitFullName", () => {
    it("splits single-word names", () => {
      expect(splitFullName("Madonna")).toEqual({ givenName: "Madonna", surname: "" });
      expect(splitFullName("")).toEqual({ givenName: "", surname: "" });
      expect(splitFullName(null)).toEqual({ givenName: "", surname: "" });
    });

    it("splits standard two-word names", () => {
      expect(splitFullName("John Doe")).toEqual({ givenName: "John", surname: "Doe" });
    });

    it("splits multi-word names placing last word in surname", () => {
      expect(splitFullName("Syed Asjad Abbas")).toEqual({
        givenName: "Syed Asjad",
        surname: "Abbas",
      });
      expect(splitFullName("Mary Jane Watson")).toEqual({
        givenName: "Mary Jane",
        surname: "Watson",
      });
    });
  });

  describe("formatDateForInput", () => {
    it("formats ISO strings to YYYY-MM-DD", () => {
      expect(formatDateForInput("2030-05-15T00:00:00.000Z")).toBe("2030-05-15");
      expect(formatDateForInput("2030-05-15")).toBe("2030-05-15");
      expect(formatDateForInput("invalid-date")).toBe("");
      expect(formatDateForInput(null)).toBe("");
    });
  });

  describe("resolvePrimaryTraveller", () => {
    it("auto-fills primary traveller data from profile and vault passport", () => {
      const mockProfile: TravellerProfile = {
        userId: "user_1",
        displayName: "Asjad Abbas",
        phone: "+923001234567",
        nationality: "PK",
        seatPref: "window",
        mealPref: "Halal",
        preferredAirlines: ["PK", "EK"],
        preferredCabin: "BUSINESS",
        maxLayoverMinutes: 180,
        metadata: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const mockDocs: IdentityDocument[] = [
        {
          id: "doc_1",
          ownerUserId: "user_1",
          type: "PASSPORT",
          documentNumber: "PK987654321",
          countryCode: "PK",
          documentSubtype: null,
          issuedAt: "2020-01-01T00:00:00.000Z",
          expiresAt: "2030-01-01T00:00:00.000Z",
          vaultDocumentId: "vault_1",
          status: "ACTIVE",
          supersedesId: null,
          verificationStatus: "VERIFIED",
          verifiedAt: "2026-01-01T00:00:00.000Z",
          verifiedByUserId: "admin",
          verificationNote: null,
          companionId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ];

      const res = resolvePrimaryTraveller(mockProfile, mockDocs, {
        name: "Asjad Abbas",
        email: "asjad@flightone.ai",
      });

      expect(res.givenName).toBe("Asjad");
      expect(res.surname).toBe("Abbas");
      expect(res.nationality).toBe("PK");
      expect(res.passportNumber).toBe("PK987654321");
      expect(res.passportExpiry).toBe("2030-01-01");
      expect(res.phone).toBe("+923001234567");
      expect(res.email).toBe("asjad@flightone.ai");
      expect(res.isAutoFilled).toBe(true);
      expect(res.companionId).toBeNull();
    });

    it("gracefully falls back when profile is empty or partially populated", () => {
      const res = resolvePrimaryTraveller(null, [], {
        name: "Solo Traveller",
        email: "guest@example.com",
      });

      expect(res.givenName).toBe("Solo");
      expect(res.surname).toBe("Traveller");
      expect(res.nationality).toBe("");
      expect(res.passportNumber).toBe("");
      expect(res.passportExpiry).toBe("");
      expect(res.email).toBe("guest@example.com");
    });
  });

  describe("resolveCompanionTraveller", () => {
    it("maps companion data with passport details", () => {
      const companion: Companion = {
        id: "comp_1",
        ownerUserId: "user_1",
        kind: "FAMILY",
        fullName: "Sarah Connor",
        relationship: "Spouse",
        dateOfBirth: "1990-08-20T00:00:00.000Z",
        passportNumber: "US12345678",
        passportExpiry: "2032-12-31T00:00:00.000Z",
        hasPassport: true,
        metadata: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const res = resolveCompanionTraveller(companion, []);

      expect(res.givenName).toBe("Sarah");
      expect(res.surname).toBe("Connor");
      expect(res.dateOfBirth).toBe("1990-08-20");
      expect(res.passportNumber).toBe("US12345678");
      expect(res.passportExpiry).toBe("2032-12-31");
      expect(res.companionId).toBe("comp_1");
      expect(res.sourceLabel).toContain("Spouse");
    });
  });

  describe("buildTravellerSnapshot & validateTravellerFormData", () => {
    it("builds a clean snapshot matching server expectations", () => {
      const formData: TravellerFormData = {
        givenName: "John",
        surname: "Smith",
        nationality: "gb",
        dateOfBirth: "1985-04-12",
        passportNumber: "GB998877",
        passportExpiry: "2029-06-30",
        phone: "+44123456789",
        email: "john.smith@example.co.uk",
        companionId: "comp_99",
      };

      const snapshot = buildTravellerSnapshot(formData);
      expect(snapshot).toEqual({
        givenName: "John",
        surname: "Smith",
        fullName: "John Smith",
        nationality: "GB",
        dateOfBirth: "1985-04-12",
        passportNumber: "GB998877",
        passportExpiry: "2029-06-30",
        phone: "+44123456789",
        email: "john.smith@example.co.uk",
        companionId: "comp_99",
      });

      const validation = validateTravellerFormData(formData);
      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });

    it("validates missing given name and surname", () => {
      const emptyForm: TravellerFormData = {
        givenName: "",
        surname: "",
        nationality: "",
        dateOfBirth: "",
        passportNumber: "",
        passportExpiry: "",
        phone: "",
        email: "",
      };

      const validation = validateTravellerFormData(emptyForm);
      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain("givenName");
      expect(validation.missingFields).toContain("surname");
    });
  });
});
