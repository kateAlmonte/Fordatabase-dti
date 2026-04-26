import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import initialTemplateData from "./data/awpb_dropdown_tree.json";
import { authService, entriesService, submissionService } from "./services/supabaseService";

import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import MyEntries from "./pages/MyEntries";
import SubmitEntry from "./pages/SubmitEntry";
import AdminReview from "./pages/AdminReview";
import AdminDashboard from "./pages/AdminDashboard";
import ManageAccounts from "./pages/ManageAccounts";
import AddNewAccount from "./pages/AddNewAccount";
import ManageTemplate from "./pages/ManageTemplate";

const INITIAL_ACCOUNTS = [
  {
    id: "acc-001",
    username: "enc_user",
    fullName: "Default Encoder",
    email: "encoder@dti.gov.ph",
    role: "encoder",
    status: "active",
  },
  {
    id: "acc-002",
    username: "adm_admin",
    fullName: "Default Admin",
    email: "admin@dti.gov.ph",
    role: "admin",
    status: "active",
  },
];

function createInitialTemplateState() {
  return JSON.parse(JSON.stringify(initialTemplateData));
}

function App() {
  const [entries, setEntries] = useState([]);
  const [entryBeingEdited, setEntryBeingEdited] = useState(null);
  const [submitEntryDraft, setSubmitEntryDraft] = useState(null);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [templateData, setTemplateData] = useState(createInitialTemplateState);

  const [submissionWindow, setSubmissionWindow] = useState({
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  });

  const [authUser, setAuthUser] = useState(null);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const toastDismissRef = useRef(null);

  const isAuthenticated = Boolean(authUser);
  const currentRole = authUser?.role || null;
  const encoderEntries = useMemo(() => {
    if (!authUser?.id) return [];

    return entries.filter((entry) => entry.ownerId === authUser.id);
  }, [authUser?.id, entries]);

  const handleLogin = (user) => {
    setAuthUser({
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName || user.username,
    });

    setAccounts((prev) => {
      const existingIndex = prev.findIndex((account) => account.username === user.username);
      const nextAccount = {
        id: user.id,
        username: user.username,
        fullName: user.fullName || user.username,
        email: user.email || "",
        role: user.role,
        status: user.status || "active",
      };

      if (existingIndex === -1) {
        return [nextAccount, ...prev];
      }

      return prev.map((account, index) =>
        index === existingIndex ? { ...account, ...nextAccount } : account,
      );
    });
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      showToast({
        title: "Logout issue",
        description: error?.message || "The session could not be cleared cleanly.",
        type: "error",
      });
    }

    setAuthUser(null);
    setEntries([]);
    setEntryBeingEdited(null);
    setSubmitEntryDraft(null);
  };

  const showToast = ({ title, description = "", type = "info" }) => {
    const id = Date.now();
    setToast({ id, title, description, type, exiting: false });

    window.clearTimeout(toastTimeoutRef.current);
    window.clearTimeout(toastDismissRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      dismissToast(id);
    }, 2600);
  };

  const dismissToast = (toastId) => {
    setToast((current) => {
      if (!current || current.id !== toastId || current.exiting) {
        return current;
      }

      return {
        ...current,
        exiting: true,
      };
    });

    window.clearTimeout(toastDismissRef.current);
    toastDismissRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === toastId ? null : current));
    }, 220);
  };

  const handleAddEntry = (newEntry) => {
    setEntries((prev) => [newEntry, ...prev]);
  };

  const handleUpdateEntry = async (entryId, updates) => {
    const databaseUpdates = {};

    if (updates.status !== undefined) {
      databaseUpdates.status = updates.status;
    }
    if (updates.adminComment !== undefined) {
      databaseUpdates.reviewer_notes = updates.adminComment || null;
    }
    if (updates.reviewedAt !== undefined) {
      databaseUpdates.review_date = updates.reviewedAt || null;
    }
    if (updates.reviewedAt !== undefined && authUser?.id) {
      databaseUpdates.reviewer_id = authUser.id;
    }

    if (updates.status === "Pending Review") {
      databaseUpdates.reviewer_notes = null;
      databaseUpdates.review_date = null;
      databaseUpdates.reviewer_id = null;
    }

    const updatedEntry =
      Object.keys(databaseUpdates).length > 0
        ? await entriesService.update(entryId, databaseUpdates)
        : null;

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...(updatedEntry || entry), ...updates } : entry,
      ),
    );

    return updatedEntry;
  };

  const handleDeleteEntry = async (entryId) => {
    await entriesService.delete(entryId);
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
  };

  const handleStartEdit = (entry) => {
    setEntryBeingEdited(entry);
  };

  const handleSaveEditedEntry = (entryId, updatedEntry) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? updatedEntry : entry)),
    );
    setEntryBeingEdited(null);
  };

  const clearEditingEntry = () => {
    setEntryBeingEdited(null);
  };

  const clearSubmitEntryDraft = () => {
    setSubmitEntryDraft(null);
  };

  const handleAddAccount = (newAccount) => {
    setAccounts((prev) => [newAccount, ...prev]);
  };

  const handleUpdateAccount = (accountId, updates) => {
    setAccounts((prev) =>
      prev.map((account) =>
        account.id === accountId ? { ...account, ...updates } : account,
      ),
    );
  };

  useEffect(() => {
    if (!authUser?.id) return;

    const matchedAccount = accounts.find((account) => account.id === authUser.id);

    if (matchedAccount && matchedAccount.status !== "active") {
      setAuthUser(null);
      setEntries([]);
      setEntryBeingEdited(null);
      setSubmitEntryDraft(null);
      return;
    }

    setAuthUser((prev) => {
      if (!prev) return prev;

      const nextUser = matchedAccount ? {
        ...prev,
        username: matchedAccount.username,
        role: matchedAccount.role,
        fullName: matchedAccount.fullName || matchedAccount.username,
      } : prev;

      if (
        prev.username === nextUser.username &&
        prev.role === nextUser.role &&
        prev.fullName === nextUser.fullName
      ) {
        return prev;
      }

      return nextUser;
    });
  }, [accounts, authUser?.id]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user) return;

        const profile = await authService.getProfile(user.id);
        if (!isMounted || !profile) return;

        handleLogin({
          id: user.id,
          username: profile.username,
          email: profile.email,
          fullName: profile.full_name,
          role: profile.role,
          status: profile.status,
        });
      } catch {
        // Ignore silent restore failures and let the user sign in manually.
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authUser?.id) return undefined;

    let isMounted = true;

    const hydrateAppData = async () => {
      setIsEntriesLoading(true);
      try {
        const [loadedEntries, activeWindow] = await Promise.all([
          entriesService.getAll(),
          submissionService.getActiveWindow().catch(() => null),
        ]);

        if (!isMounted) return;

        setEntries(loadedEntries);

        if (activeWindow?.start_date && activeWindow?.end_date) {
          setSubmissionWindow({
            startDate: activeWindow.start_date,
            endDate: activeWindow.end_date,
          });
        }
      } catch (error) {
        if (!isMounted) return;

        showToast({
          title: "Unable to load entries",
          description:
            error?.message ||
            "The app could not load your latest Supabase data.",
          type: "error",
        });
      } finally {
        if (isMounted) {
          setIsEntriesLoading(false);
        }
      }
    };

    hydrateAppData();

    return () => {
      isMounted = false;
    };
  }, [authUser?.id]);

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimeoutRef.current);
      window.clearTimeout(toastDismissRef.current);
    };
  }, []);

  const navItems = useMemo(() => {
    if (currentRole === "admin") {
      return [
        { to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
        { to: "/admin/review", label: "Admin Review", icon: "review" },
        { to: "/admin/manage-template", label: "Manage Template", icon: "template" },
        {
          label: "Manage Accounts",
          icon: "accounts",
          subItems: [
            { to: "/admin/manage-accounts", label: "All Accounts" },
            { to: "/admin/manage-accounts/new", label: "Add New Account" },
          ],
        },
      ]
    }

    return [
      { to: "/", label: "Home", icon: "dashboard" },
      { to: "/entries", label: "My Entries", icon: "entries" },
      { to: "/submit", label: "Submit Entry", icon: "submit" },
    ]
  }, [currentRole])

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route
          path="/login"
          element={<Login onLogin={handleLogin} accounts={accounts} />}
        />
        <Route
          path="/forgot-password"
          element={<ForgotPassword accounts={accounts} />}
        />
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    );
  }

  return (
    <AppLayout
      navItems={navItems}
      currentRole={currentRole}
      currentUser={authUser}
      onLogout={handleLogout}
      toast={toast}
      onDismissToast={() => {
        if (toast?.id) {
          dismissToast(toast.id);
        }
      }}
    >
      <Routes>
        <Route
          path="/login"
          element={
            <Navigate
              to={currentRole === "admin" ? "/admin/dashboard" : "/"}
              replace
            />
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Navigate
              to={currentRole === "admin" ? "/admin/dashboard" : "/"}
              replace
            />
          }
        />
        <Route
          path="/"
          element={
            currentRole === "encoder" ? (
              <Home
                entries={encoderEntries}
                submissionWindow={submissionWindow}
                isLoading={isEntriesLoading}
              />
            ) : (
              <Navigate to="/admin/dashboard" replace />
            )
          }
        />

        <Route
          path="/entries"
          element={
            currentRole === "encoder" ? (
              <MyEntries
                entries={encoderEntries}
                onEditEntry={handleStartEdit}
                onDeleteEntry={handleDeleteEntry}
                onShowToast={showToast}
                submissionWindow={submissionWindow}
                isLoading={isEntriesLoading}
              />
            ) : (
              <Navigate to="/admin/dashboard" replace />
            )
          }
        />

        <Route
          path="/submit"
          element={
            currentRole === "encoder" ? (
              <SubmitEntry
                onAddEntry={handleAddEntry}
                entryToEdit={entryBeingEdited}
                onSaveEditedEntry={handleSaveEditedEntry}
                clearEditingEntry={clearEditingEntry}
                submissionWindow={submissionWindow}
                draftState={submitEntryDraft}
                onDraftChange={setSubmitEntryDraft}
                onClearDraft={clearSubmitEntryDraft}
                currentUser={authUser}
                templateData={templateData}
                onShowToast={showToast}
              />
            ) : (
              <Navigate to="/admin/dashboard" replace />
            )
          }
        />

        <Route
          path="/admin/manage-template"
          element={
            currentRole === "admin" ? (
              <ManageTemplate
                templateData={templateData}
                onUpdateTemplateData={setTemplateData}
                onResetTemplate={() => setTemplateData(createInitialTemplateState())}
                onShowToast={showToast}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            currentRole === "admin" ? (
              <AdminDashboard
                entries={entries}
                submissionWindow={submissionWindow}
                onUpdateSubmissionWindow={setSubmissionWindow}
                isLoading={isEntriesLoading}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/admin/review"
          element={
            currentRole === "admin" ? (
              <AdminReview
                entries={entries}
                onUpdateEntry={handleUpdateEntry}
                onDeleteEntry={handleDeleteEntry}
                submissionWindow={submissionWindow}
                onShowToast={showToast}
                isLoading={isEntriesLoading}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/admin/manage-accounts"
          element={
            currentRole === "admin" ? (
              <ManageAccounts
                accounts={accounts}
                onUpdateAccount={handleUpdateAccount}
                onShowToast={showToast}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/admin/manage-accounts/new"
          element={
            currentRole === "admin" ? (
              <AddNewAccount
                accounts={accounts}
                onAddAccount={handleAddAccount}
                onShowToast={showToast}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />


      </Routes>
    </AppLayout>
  );
}

export default App;
