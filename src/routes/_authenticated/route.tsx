import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await apiClient.auth.getMe();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
