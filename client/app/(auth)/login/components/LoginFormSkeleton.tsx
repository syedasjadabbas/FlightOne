/** Colocated login Suspense fallback — matches signup auth-form surface. */
export function LoginFormSkeleton() {
  return (
    <div className="fo-auth-form fo-login">
      <div className="fo-auth__panel fo-auth__panel--skeleton" aria-hidden>
        <div className="fo-auth__skel fo-auth__skel--brand" />
        <div className="fo-auth__skel fo-auth__skel--title" />
        <div className="fo-auth__skel fo-auth__skel--lead" />
        <div className="fo-auth__skel-stack">
          <div className="fo-auth__skel fo-auth__skel--label" />
          <div className="fo-auth__skel fo-auth__skel--field" />
          <div className="fo-auth__skel fo-auth__skel--label" />
          <div className="fo-auth__skel fo-auth__skel--field" />
          <div className="fo-auth__skel fo-auth__skel--forgot" />
          <div className="fo-auth__skel fo-auth__skel--submit" />
        </div>
      </div>
    </div>
  );
}
