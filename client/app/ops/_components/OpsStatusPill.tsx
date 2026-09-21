export function OpsStatusPill({ state }: { state: string }) {
  const warn =
    /FAIL|MISMATCH|UNCONFIG|ERROR|ATTENTION/i.test(state) ||
    state === "SKIPPED_UNCONFIGURED";
  const ok = /DELIVERED|MATCHED|OK|READY|ACTIVE|CONFIGURED/i.test(state) && !warn;

  const cls = ok
    ? "fo-desk__status fo-desk__status--ok"
    : warn
      ? "fo-desk__status fo-desk__status--warn"
      : "fo-desk__status";

  return <span className={cls}>{state}</span>;
}
