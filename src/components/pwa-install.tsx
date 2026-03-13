"use client";

import { useEffect } from "react";

export function PwaInstall() {
  useEffect(() => {
    import("@khmyznikov/pwa-install").catch(() => {});
  }, []);

  return (
    <pwa-install
      manifest-url="/manifest.webmanifest"
      name="Cursor Local Remote"
      description="Control Cursor IDE from any device on your local network"
      icon="/apple-touch-icon.png"
    />
  );
}
