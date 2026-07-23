import { getChatGPTUser } from "./chatgpt-auth";
import JournalApp from "./JournalApp";
import LoginGate from "./LoginGate";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const params = await searchParams;
  const user = await getChatGPTUser();
  if (!user || params.app !== "1") return <LoginGate />;
  return <JournalApp user={{ displayName: user.displayName, email: user.email }} />;
}
