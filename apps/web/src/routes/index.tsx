import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { DashboardHome } from "@/components/DashboardHome";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <DashboardHome />;
}
