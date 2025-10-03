import { createRootRouteWithContext, Outlet, useLocation } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

interface RouterContext {
  queryClient: QueryClient;
}

function RootComponent() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Don't show app shell on login page
  const isLoginPage = location.pathname === "/login";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Show app shell only for authenticated users and not on login page
  if (user && !isLoginPage) {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }

  // Login page or unauthenticated - no shell
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AuthProvider>
      <RootComponent />
    </AuthProvider>
  ),
});
