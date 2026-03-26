import LoadingBoard from "@/components/shared/LoadingBoard";

export default function Loading() {
  return (
    <div className="p-4 pt-12">
      <LoadingBoard message="LOADING STATIONS..." />
    </div>
  );
}
