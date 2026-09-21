/** Colocated signup Suspense fallback — four-field shape, no empty flash. */
export function SignupFormSkeleton() {
  return (
    <div className="fo-auth-form fo-signup">
      <div className="fo-auth__panel fo-auth__panel--skeleton fo-signup__panel" aria-hidden>
        <div className="fo-auth__skel fo-auth__skel--brand" />
        <div className="fo-auth__skel fo-auth__skel--title" />
        <div className="fo-auth__skel fo-auth__skel--lead" />
        <div className="fo-auth__skel-stack fo-auth__skel-stack--signup">
          <div className="fo-auth__skel fo-auth__skel--label" />
          <div className="fo-auth__skel fo-auth__skel--field" />
          <div className="fo-auth__skel fo-auth__skel--label" />
          <div className="fo-auth__skel fo-auth__skel--field" />
          <div className="fo-auth__skel--row">
            <div>
              <div className="fo-auth__skel fo-auth__skel--label" />
              <div className="fo-auth__skel fo-auth__skel--field" />
            </div>
            <div>
              <div className="fo-auth__skel fo-auth__skel--label" />
              <div className="fo-auth__skel fo-auth__skel--field" />
            </div>
          </div>
          <div className="fo-auth__skel fo-auth__skel--submit" />
        </div>
      </div>
    </div>
  );
}
