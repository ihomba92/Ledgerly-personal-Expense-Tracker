import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/store/Auth";

/** Wraps the /app pages: guests are sent to the login page and brought back afterwards. */
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center" role="status" aria-label="Loading">
        <span className="material-symbols-outlined animate-spin text-primary text-[28px]">progress_activity</span>
      </div>
    );
  }
  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}
