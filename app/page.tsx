"use client";

import dynamic from "next/dynamic";

// Elah uses WebGL2, WebCodecs and Workers: it must never server-render.
const Studio = dynamic(() => import("@/components/Studio"), { ssr: false });

export default function Page() {
  return <Studio />;
}
