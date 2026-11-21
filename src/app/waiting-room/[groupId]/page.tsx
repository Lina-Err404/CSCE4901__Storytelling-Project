import WaitingRoom from "./waitingRoom";

export default async function WaitingRoomPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return <WaitingRoom groupId={groupId} />;
}