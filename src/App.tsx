import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import RoleSelection from "./pages/RoleSelection";
import MasterSetup from "./pages/MasterSetup";
import ModerationPending from "./pages/ModerationPending";
import CreateTask from "./pages/CreateTask";
import MyResponses from "./pages/MyResponses";
import ProfilePage from "./pages/ProfilePage";
import { AppLayout } from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  // Authenticated but no role selected yet (name is empty = just created via trigger)
  if (profile && !profile.name) {
    return (
      <Routes>
        <Route path="/role-selection" element={<RoleSelection />} />
        <Route path="/master-setup" element={<MasterSetup />} />
        <Route path="/moderation-pending" element={<ModerationPending />} />
        <Route path="*" element={<Navigate to="/role-selection" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/role-selection" element={<RoleSelection />} />
      <Route path="/master-setup" element={<MasterSetup />} />
      <Route path="/moderation-pending" element={<ModerationPending />} />
      <Route path="/create-task" element={<AppLayout><CreateTask /></AppLayout>} />
      <Route path="/my-responses" element={<AppLayout><MyResponses /></AppLayout>} />
      <Route path="/profile" element={<AppLayout><ProfilePage /></AppLayout>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
