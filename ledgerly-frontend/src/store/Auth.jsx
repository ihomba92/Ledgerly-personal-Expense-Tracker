import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, session, setUnauthorizedHandler } from "@/lib/api";
import { initialsOf } from "@/lib/mappers";
import { setActiveCurrency } from "@/lib/utils";

/**
 * Who is logged in.
 *   status: "loading" (checking the saved token) | "authenticated" | "guest"
 * The login token is kept in localStorage; on load we ask /auth/me whether it's still valid.
 */
const AuthContext = createContext(null);

const withExtras = (user) => (user ? { ...user, name: user.full_name, initials: initialsOf(user.full_name), role: user.ledger_name } : null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(session.token ? "loading" : "guest");
  const [avatarUrl, setAvatarUrl] = useState(null); // the profile picture as a local blob: URL

  const applyUser = useCallback((u) => {
    setUser(withExtras(u));
    setActiveCurrency(u?.currency);
  }, []);

  const signOut = useCallback(() => {
    session.clear();
    setUser(null);
    setAvatarUrl(null);
    setActiveCurrency(null);
    setStatus("guest");
  }, []);

  // Any 401 from the API (expired or replaced login) signs the user out.
  useEffect(() => setUnauthorizedHandler(signOut), [signOut]);

  // Check a saved token once when the app opens.
  useEffect(() => {
    if (!session.token) return;
    api("/auth/me")
      .then((data) => {
        applyUser(data.user);
        setStatus("authenticated");
      })
      .catch(() => signOut());
  }, [applyUser, signOut]);

  // The picture needs the login token, so it's fetched once and shown from a local blob: URL.
  // avatar_version changes whenever a new picture is uploaded, which fetches it again.
  const avatarVersion = user?.has_avatar ? user.avatar_version : null;
  useEffect(() => {
    if (!avatarVersion) {
      setAvatarUrl(null);
      return;
    }
    let url = null;
    let cancelled = false;
    api("/auth/me/avatar", { raw: true })
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setAvatarUrl(url);
      })
      .catch(() => setAvatarUrl(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [avatarVersion]);

  const uploadAvatar = useCallback(
    async (file) => {
      const form = new FormData();
      form.append("file", file);
      const data = await api("/auth/me/avatar", { method: "POST", form });
      applyUser(data.user);
    },
    [applyUser]
  );

  const removeAvatar = useCallback(async () => {
    const data = await api("/auth/me/avatar", { method: "DELETE" });
    applyUser(data.user);
  }, [applyUser]);

  /** Store a token from login, email confirmation or a password change. */
  const applySession = useCallback(
    (token, u) => {
      session.save(token);
      applyUser(u);
      setStatus("authenticated");
    },
    [applyUser]
  );

  const login = useCallback(
    async (email, password, rememberMe) => {
      const data = await api("/auth/login", { method: "POST", auth: false, body: { email, password, remember_me: rememberMe } });
      applySession(data.access_token, data.user);
      return data.user;
    },
    [applySession]
  );

  const register = useCallback(
    (fullName, email, password) =>
      api("/auth/register", { method: "POST", auth: false, body: { full_name: fullName, email, password } }),
    []
  );

  const updateProfile = useCallback(
    async (changes) => {
      const data = await api("/auth/me", { method: "PATCH", body: changes });
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  /** Change the password, or set a first one for a Google/Microsoft account (currentPassword = null). */
  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const body = { new_password: newPassword };
      if (currentPassword) body.current_password = currentPassword;
      const data = await api("/auth/change-password", { method: "POST", body });
      session.save(data.access_token); // this device stays logged in
      applyUser(data.user);
      return data;
    },
    [applyUser]
  );

  /** confirmation = { password } or, for accounts without a password, { confirm_email } */
  const deleteAccount = useCallback(
    async (confirmation) => {
      await api("/auth/me", { method: "DELETE", body: confirmation });
      signOut();
    },
    [signOut]
  );

  const value = useMemo(
    () => ({ user, status, avatarUrl, login, register, applySession, signOut, updateProfile, changePassword, deleteAccount,
      uploadAvatar, removeAvatar }),
    [user, status, avatarUrl, login, register, applySession, signOut, updateProfile, changePassword, deleteAccount,
      uploadAvatar, removeAvatar]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
