/**
 * Shared integration capability descriptor — never invents live success.
 */
export function unconfiguredCapability(name, reasons = []) {
  return {
    name,
    state: "UNCONFIGURED",
    configured: false,
    verified: false,
    canPush: false,
    reasons: reasons.length
      ? reasons
      : [`${name} credentials/URL not configured`],
  };
}

export function configuredCapability(name, { verified = false, reasons = [] } = {}) {
  return {
    name,
    state: verified ? "VERIFIED" : "CONFIGURED",
    configured: true,
    verified,
    canPush: true,
    reasons,
  };
}
