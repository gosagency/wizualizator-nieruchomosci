"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { BrandStyle } from "@/components/BrandStyle";
import { useHydrated, useOffer, useOrg } from "@/lib/demo/store";

const ApartmentViewer = dynamic(() => import("@/components/model3d/ApartmentViewer"), { ssr: false });

/** Minimal page for <iframe> embedding on an office website or in a CRM. */
export default function EmbedOffer() {
  const { slug } = useParams<{ slug: string }>();
  const hydrated = useHydrated();
  const offer = useOffer(slug);
  const org = useOrg();
  if (!hydrated) return null;
  if (!offer) return <p className="p-6 text-center text-sm text-stone-500">Oferta niedostępna.</p>;
  return (
    <div className="p-2">
      <BrandStyle />
      <ApartmentViewer plan={offer.plan} accent={org.color} />
      <p className="mt-2 text-center text-xs text-stone-500">
        <a href={`/o/${offer.slug}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
          Pełna oferta: {org.name} ↗
        </a>
      </p>
    </div>
  );
}
