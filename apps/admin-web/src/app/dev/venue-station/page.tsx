import { notFound } from "next/navigation";
import { VenueStationPreview } from "./preview";

export default function VenuePreviewPage() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.ENABLE_VENUE_PREVIEW !== "true"
  )
    notFound();
  return <VenueStationPreview />;
}
