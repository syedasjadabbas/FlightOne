"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

export function QrCode({ value, size = 180, className = "", alt = "QR Code" }: QrCodeProps) {
  const [svgXml, setSvgXml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) {
      setSvgXml(null);
      return;
    }

    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      width: size,
      color: {
        dark: "#0b2238",
        light: "#ffffff",
      },
    })
      .then((svg) => {
        if (active) setSvgXml(svg);
      })
      .catch(() => {
        if (active) setSvgXml(null);
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (!svgXml) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400 ${className}`}
        style={{ width: size, height: size }}
        aria-label={alt}
      >
        Generating QR…
      </div>
    );
  }

  return (
    <div
      className={`inline-block overflow-hidden rounded-xl border border-slate-200/90 bg-white p-2 shadow-xs ${className}`}
      dangerouslySetInnerHTML={{ __html: svgXml }}
      role="img"
      aria-label={alt}
    />
  );
}
