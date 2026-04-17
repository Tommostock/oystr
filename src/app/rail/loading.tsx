/**
 * rail/loading.tsx — Loading state for the Rail tab
 *
 * Next.js automatically shows this component while the /rail route
 * segment is loading. Matches the app's dot-matrix aesthetic.
 */

import LoadingBoard from "@/components/shared/LoadingBoard";

export default function RailLoading() {
  return (
    <div className="p-4">
      <LoadingBoard message="LOADING RAIL..." />
    </div>
  );
}
