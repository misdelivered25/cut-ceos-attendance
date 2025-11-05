import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, Home } from "lucide-react";
import { SessionsList } from "@/components/SessionsList";
import { CreateSessionDialog } from "@/components/CreateSessionDialog";
import logo from "@/assets/cut-ceos-logo.png";
import Footer from "@/components/Footer";

const Dashboard = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))] flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src={logo} alt="CUT CEOS" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-xl font-bold">CUT CEOS Attendance</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/")} variant="ghost" size="sm">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Your Sessions</h2>
            <p className="text-muted-foreground">Create and manage attendance sessions</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} size="lg" className="shadow-lg">
            <Plus className="mr-2 h-5 w-5" />
            New Session
          </Button>
        </div>

        <SessionsList />
      </main>

      <CreateSessionDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <Footer />
    </div>
  );
};

export default Dashboard;
