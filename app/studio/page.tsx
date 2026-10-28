import type { Metadata } from "next";
import { Suspense } from "react";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = { title: "Estudio · ThumbStudio" };

export default function StudioPage() {
  // Studio reads ?c= (channel from the landing), which needs a Suspense boundary in a static export.
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}
