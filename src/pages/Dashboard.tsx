import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, QrCode } from "lucide-react";
import { SessionsList } from "@/components/SessionsList";
import { CreateSessionDialog } from "@/components/CreateSessionDialog";

const Dashboard = () => {
  const { signOut, user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <QrCode className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Attendance System</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button onClick={signOut} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
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
    </div>
  );
};

export default Dashboard;
