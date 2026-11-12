import JoinLobby from "./joinLobby";

export default async function JoinLobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinLobby code={code.toUpperCase()} />;
}