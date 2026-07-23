import { getChatGPTUser } from "./chatgpt-auth";
import JournalApp from "./JournalApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <JournalApp user={user ? { displayName: user.displayName, email: user.email } : null} />;
}
