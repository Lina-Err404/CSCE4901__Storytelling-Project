import { mockLobbies } from "@/lib/mockLobbyData";
import BreakoutManager from "../components/breakoutManager";
import Link from "next/link";

export default function Page() {
    return (
      <div style={{ paddingBottom: '60px' }}>
        <BreakoutManager lobby={mockLobbies[0]} />
        
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <Link 
            href="/starting-prompts"
            style={{
              padding: '12px 24px',
              backgroundColor: '#4f46e5',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold'
            }}
          >
            Next: Assign Starting Prompts →
          </Link>
        </div>
      </div>
    );
}