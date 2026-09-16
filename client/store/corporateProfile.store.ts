import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-side corporate profile context. Server `resolveActiveProfile` remains
 * authoritative — this store only remembers the user's last selected mode/company
 * so Ava/checkout can request the verified context.
 */
type CorporateProfileState = {
  mode: "PERSONAL" | "CORPORATE";
  companyId: string | null;
  setPersonal: () => void;
  setCorporate: (companyId: string) => void;
};

export const useCorporateProfileStore = create<CorporateProfileState>()(
  persist(
    (set) => ({
      mode: "PERSONAL",
      companyId: null,
      setPersonal: () => set({ mode: "PERSONAL", companyId: null }),
      setCorporate: (companyId: string) =>
        set({ mode: "CORPORATE", companyId: companyId.trim() || null }),
    }),
    { name: "flightone-corporate-profile" },
  ),
);
