"use client";

import { Fragment } from "react";

function parseRouteParts(route: string): string[] {
  return route
    .split(/\s*[→\-–]\s*|\s+to\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function RouteEditorial({ route }: { route: string }) {
  const parts = parseRouteParts(route);
  if (parts.length <= 1) {
    return <h1 className="results-route-headline">{route}</h1>;
  }
  return (
    <div className="results-route-editorial" aria-label={route}>
      {parts.map((part, i) => (
        <Fragment key={`${part}-${i}`}>
          {i > 0 ? (
            <span className="results-route-editorial__arrow" aria-hidden>
              →
            </span>
          ) : null}
          <span className="results-route-editorial__city">{part}</span>
        </Fragment>
      ))}
    </div>
  );
}
