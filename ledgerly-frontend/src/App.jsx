import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import OAuthCallback from "@/pages/OAuthCallback";
import { RequireAuth } from "@/components/layout/RequireAuth";
import NotFound from "@/pages/NotFound";
const Dashboard = lazy(() => import("@/pages/app/Dashboard"));
const Expenses = lazy(() => import("@/pages/app/Expenses"));
const Wallet = lazy(() => import("@/pages/app/Wallet"));
const Income = lazy(() => import("@/pages/app/Income"));
const Categories = lazy(() => import("@/pages/app/Categories"));
const Settings = lazy(() => import("@/pages/app/Settings"));
const Support = lazy(() => import("@/pages/app/Support"));

export default function App() {
  return (
    <Routes>
      {/* Public marketing site */}
      <Route element={<MarketingLayout />}>
        <Route index element={<Landing />} />
      </Route>

      {/* Authentication */}
      <Route element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="auth/callback" element={<OAuthCallback />} />
      </Route>

      {/* The signed-in ledger: guests are sent to /login. */}
      <Route path="app" element={<RequireAuth><Suspense fallback={<PageLoader />}><AppLayout /></Suspense></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="income" element={<Income />} />
        <Route path="categories" element={<Categories />} />
        <Route path="settings" element={<Settings />} />
        <Route path="support" element={<Support />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <span className="material-symbols-outlined animate-spin text-primary text-[28px]">progress_activity</span>
    </div>
  );
}
