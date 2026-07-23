import { getChatGPTUser } from "./chatgpt-auth";
import JournalApp from "./JournalApp";
import LoginGate from "./LoginGate";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) return <LoginGate />;
  return <JournalApp user={{ displayName: user.displayName, email: user.email, username: user.username }} />;
}
