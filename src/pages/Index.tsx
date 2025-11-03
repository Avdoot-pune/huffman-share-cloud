import { Session } from "@supabase/supabase-js";
import { AuthPage } from "@/components/AuthPage";
import { Dashboard } from "@/components/Dashboard";

interface IndexProps {
  session: Session | null;
}

const Index = ({ session }: IndexProps) => {
  if (!session) {
    return <AuthPage />;
  }

  return <Dashboard userId={session.user.id} />;
};

export default Index;
