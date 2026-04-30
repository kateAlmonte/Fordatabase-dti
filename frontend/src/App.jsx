import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import initialTemplateData from "./data/awpb_dropdown_tree.json";

import { getTemplateHierarchy } from "./services/templateService";

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

import {
  authService,
  usersService,
  entriesService,
  submissionService,
  realtimeService,
} from "./services/supabaseService";

const INITIAL_ACCOUNTS = []; // will be replaced by Supabase data

function createInitialTemplateState() {
  return JSON.parse(JSON.stringify(initialTemplateData));
}

function App() {
  const [entries, setEntries] = useState([]);
  const [entryBeingEdited, setEntryBeingEdited] = useState(null);
  const [submitEntryDraft, setSubmitEntryDraft] = useState(null);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [templateData, setTemplateData] = useState({ hierarchy: {} });

  const [submissionWindow, setSubmissionWindow] = useState({
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  });

  useEffect(() => {
  loadTemplate();
}, []);

async function loadTemplate() {
  const { data, error } = await getTemplateHierarchy();

  if (error) {
    console.error(error);
    return;
  }

  const hierarchy = {};

  data.forEach((row) => {
    const c = row.component;
    const s = row.sub_component;
    const k = row.key_activity;

    if (!hierarchy[c]) hierarchy[c] = {};
    if (!hierarchy[c][s]) hierarchy[c][s] = {};
    if (!hierarchy[c][s][k]) hierarchy[c][s][k] = [];

    hierarchy[c][s][k].push({
      no: row.no,
      performanceIndicator: row.performance_indicator,
      subActivities: row.sub_activity ? [row.sub_activity] : [],
    });
  });

  setTemplateData({ hierarchy });
}

  const [authUser, setAuthUser] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const toastDismissRef = useRef(null);

  // ------------------------------------------------------------
  // 1. Load data from Supabase on mount
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        // Load active submission window
        const windowData = await submissionService.getActiveWindow();
        if (!cancelled) {
          setSubmissionWindow({
            id: windowData.id,
            startDate: windowData.start_date,
            endDate: windowData.end_date,
            title: windowData.title,
            is_active: windowData.is_active,
          });
        }

        // Load all profiles (accounts)
        const profiles = await usersService.getAll();
        if (!cancelled) {
          const formattedAccounts = profiles.map((profile) => ({
            id: profile.id,
            username: profile.username,
            fullName: profile.full_name,
            email: profile.email,
            role: profile.role,
            status: profile.status,
          }));
          setAccounts(formattedAccounts);
        }

        // Load entries (RLS will restrict based on role)
        const entriesData = await entriesService.getAll();
        if (!cancelled) {
          setEntries(entriesData);
        }
      } catch (error) {
        console.error("Failed to load data from Supabase:", error);
        showToast({
          title: "Data load error",
          description: error.message || "Could not load data. Please refresh.",
          type: "error",
        });
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------
  // 2. Real‑time subscription for entries
  // ------------------------------------------------------------
  useEffect(() => {
    const subscription = realtimeService.subscribeToEntries((payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      if (eventType === "INSERT") {
        setEntries((prev) => [newRecord, ...prev]);
      } else if (eventType === "UPDATE") {
        setEntries((prev) =>
          prev.map((entry) => (entry.id === newRecord.id ? newRecord : entry))
        );
      } else if (eventType === "DELETE") {
        setEntries((prev) =>
          prev.filter((entry) => entry.id !== oldRecord.id)
        );
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ------------------------------------------------------------
  // 3. Auth helpers
  // ------------------------------------------------------------
  const isAuthenticated = Boolean(authUser);
  const currentRole = authUser?.role || null;

  const encoderEntries = useMemo(() => {
    if (!authUser?.id) return [];
    return entries.filter((entry) => entry.owner_id === authUser.id);
  }, [authUser?.id, entries]);

  // ------------------------------------------------------------
  // 4. Handlers that persist to Supabase
  // ------------------------------------------------------------
  const handleAddEntry = async (newEntry) => {
    try {
      const created = await entriesService.create(newEntry);
      setEntries((prev) => [created, ...prev]);
      showToast({
        title: "Entry submitted",
        description: `${created.title_of_activities} was submitted.`,
        type: "success",
      });
    } catch (error) {
      console.error("Failed to create entry:", error);
      showToast({
        title: "Submission failed",
        description: error.message,
        type: "error",
      });
    }
  };

  const handleUpdateEntry = (entryId, updatedEntry) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? updatedEntry : entry))
    );
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      await entriesService.delete(entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      showToast({
        title: "Entry deleted",
        description: "The entry was removed.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to delete entry:", error);
      showToast({
        title: "Delete failed",
        description: error.message,
        type: "error",
      });
    }
  };

  const handleUpdateSubmissionWindow = async (updater) => {
    if (!submissionWindow) return;
    const newWindow = updater(submissionWindow);
    try {
      const updated = await submissionService.updateWindow(submissionWindow.id, {
        start_date: newWindow.startDate,
        end_date: newWindow.endDate,
        is_active: newWindow.is_active,
      });
      setSubmissionWindow({
        id: updated.id,
        startDate: updated.start_date,
        endDate: updated.end_date,
        title: updated.title,
        is_active: updated.is_active,
      });
      showToast({
        title: "Submission window updated",
        description: "New dates have been saved.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to update submission window:", error);
      showToast({
        title: "Update failed",
        description: error.message,
        type: "error",
      });
    }
  };

  // Account management (optional – you can keep the local mock or implement real API)
  // For now we keep the existing handlers that modify local state (they don't touch Supabase).
  // To fully integrate, you would need a service role key or edge functions.
  // I'll leave them as they were, but you can expand later.

  const handleAddAccount = (newAccount) => {
    setAccounts((prev) => [newAccount, ...prev]);
  };

  const handleUpdateAccount = (accountId, updates) => {
    setAccounts((prev) =>
      prev.map((account) =>
        account.id === accountId ? { ...account, ...updates } : account
      )
    );
  };

  // ------------------------------------------------------------
  // 5. Toast helpers (unchanged)
  // ------------------------------------------------------------
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
      if (!current || current.id !== toastId || current.exiting) return current;
      return { ...current, exiting: true };
    });
    window.clearTimeout(toastDismissRef.current);
    toastDismissRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === toastId ? null : current));
    }, 220);
  };

  // ------------------------------------------------------------
  // 6. Login / Logout
  // ------------------------------------------------------------
  const handleLogin = (user) => {
    setAuthUser(user);
    // Reload data to ensure we have the correct entries for the user
    const reloadData = async () => {
      try {
        const entriesData = await entriesService.getAll();
        setEntries(entriesData);
      } catch (error) {
        console.error("Failed to reload entries after login:", error);
      }
    };
    reloadData();
  };

  const handleLogout = () => {
    setAuthUser(null);
    setEntryBeingEdited(null);
    setSubmitEntryDraft(null);
  };

  // ------------------------------------------------------------
  // 7. Edit / Draft helpers
  // ------------------------------------------------------------
  const handleStartEdit = (entry) => {
    setEntryBeingEdited(entry);
  };

  const handleSaveEditedEntry = async (entryId, updatedEntry) => {
    // This is called after the encoder resubmits a returned entry.
    // We can reuse handleUpdateEntry.
    await handleUpdateEntry(entryId, updatedEntry);
    setEntryBeingEdited(null);
  };

  const clearEditingEntry = () => {
    setEntryBeingEdited(null);
  };

  const clearSubmitEntryDraft = () => {
    setSubmitEntryDraft(null);
  };

  // ------------------------------------------------------------
  // 8. Navigation items
  // ------------------------------------------------------------
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
      ];
    }
    return [
      { to: "/", label: "Home", icon: "dashboard" },
      { to: "/entries", label: "My Entries", icon: "entries" },
      { to: "/submit", label: "Submit Entry", icon: "submit" },
    ];
  }, [currentRole]);

  // ------------------------------------------------------------
  // 9. Render
  // ------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} accounts={accounts} />} />
        <Route path="/forgot-password" element={<ForgotPassword accounts={accounts} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
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
        if (toast?.id) dismissToast(toast.id);
      }}
    >
      <Routes>
        <Route
          path="/login"
          element={<Navigate to={currentRole === "admin" ? "/admin/dashboard" : "/"} replace />}
        />
        <Route
          path="/forgot-password"
          element={<Navigate to={currentRole === "admin" ? "/admin/dashboard" : "/"} replace />}
        />
        <Route
          path="/"
          element={
            currentRole === "encoder" ? (
              <Home entries={encoderEntries} submissionWindow={submissionWindow} />
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
                onUpdateSubmissionWindow={handleUpdateSubmissionWindow}
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
                onShowToast={showToast}
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