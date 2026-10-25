import { mockLobbies } from "@/lib/mockLobbyData";
import BreakoutManager from "../components/breakoutManager";

export default function Page() {
    // Calls the BreakoutManager Component for this mock lobby data.
    return <BreakoutManager lobby={mockLobbies[0]} />;
}