import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, LogOut, Home, Users, Calendar, BarChart3, TrendingUp, FileText } from "lucide-react";
import { AnalyticsTab } from "@/components/AnalyticsTab";
import { SessionsList } from "@/components/SessionsList";
import { CreateSessionDialog } from "@/components/CreateSessionDialog";
import { MembersPage } from "@/components/MembersPage";
import { CrossSessionComparisonDialog } from "@/components/CrossSessionComparisonDialog";
import { MinutesTab } from "@/components/MinutesTab";
import logo from "@/assets/cut-ceos-logo.png";
import Footer from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";

const Dashboard = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sessions");

  return (
    <div className="min-h-screen bg-dots flex flex-col">
      <header className="border-b bg-ambient/70 backdrop-blur-md shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src={logo} alt="CUT CEOS" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-xl font-bold">CUT CEOS Attendance</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <TabsList>
              <TabsTrigger value="sessions" className="gap-2">
                <Calendar className="h-4 w-4" />
                Sessions
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-2">
                <Users className="h-4 w-4" />
                Members
              </TabsTrigger>
              <TabsTrigger value="minutes" className="gap-2">
                <FileText className="h-4 w-4" />
                Minutes
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
            {activeTab === "sessions" && (
              <div className="flex gap-2">
                <Button onClick={() => setIsCompareOpen(true)} variant="outline" size="lg">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Compare
                </Button>
                <Button onClick={() => setIsCreateOpen(true)} size="lg" className="shadow-lg">
                  <Plus className="mr-2 h-5 w-5" />
                  New Session
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="sessions" className="mt-0">
            <SessionsList />
          </TabsContent>

          <TabsContent value="members" className="mt-0">
            <MembersPage />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <AnalyticsTab />
          </TabsContent>
        </Tabs>
      </main>

      <CreateSessionDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <CrossSessionComparisonDialog open={isCompareOpen} onOpenChange={setIsCompareOpen} />
      <Footer />
    </div>
  );
};

export default Dashboard;
