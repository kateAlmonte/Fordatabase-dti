import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, RotateCcw, Search, UserPlus, UserX } from "lucide-react";

import AdminDeactivateUserModal from "@/components/admin/AdminDeactivateUserModal";
import AdminEditUserModal from "@/components/admin/AdminEditUserModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// === SUPABASE INTEGRATION ===
// We import `usersService` which is our thin wrapper around Supabase's client.
// Previously this page received hardcoded dummy accounts via props and only
// updated them in local React state (nothing was persisted). Now we load the
// real users from the `profiles` table in Supabase and save every change back
// to the database.
import { usersService } from "@/services/supabaseService";

// ---------------------------------------------------------------------------
// FIX #1: Data shape mismatch
// ---------------------------------------------------------------------------
// Supabase's `profiles` table uses snake_case column names (e.g. `full_name`)
// while our UI components expect camelCase (e.g. `fullName`). We use these two
// helper functions to translate between the two formats so the rest of the
// component code doesn't have to change.
// ---------------------------------------------------------------------------

// Convert a Supabase `profiles` row  -> the shape this page's UI expects.
function mapProfileToAccount(profile) {
  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name, // snake_case -> camelCase
    email: profile.email,
    role: profile.role,
    status: profile.status,
  };
}

// Convert UI-style updates  -> the `profiles` column names used by Supabase.
function mapUpdatesToProfile(updates) {
  const payload = {};
  if (updates.username !== undefined) payload.username = updates.username;
  if (updates.fullName !== undefined) payload.full_name = updates.fullName;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.role !== undefined) payload.role = updates.role;
  if (updates.status !== undefined) payload.status = updates.status;
  return payload;
}

const EMPTY_EDIT_FORM = {
  username: "",
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "encoder",
};

function getRoleBadgeVariant(role) {
  return role === "admin" ? "default" : "outline";
}

function getStatusBadgeVariant(status) {
  return status === "active" ? "statusApproved" : "statusRejected";
}

export default function ManageAccounts({
  accounts: accountsProp = [],
  onUpdateAccount,
  onShowToast,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editErrors, setEditErrors] = useState({});
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  // -------------------------------------------------------------------------
  // FIX #2: Page now owns the list of accounts instead of relying on props
  // -------------------------------------------------------------------------
  // Before: this page only displayed whatever `accounts` prop was passed from
  //   App.jsx (a hardcoded INITIAL_ACCOUNTS array). It could never see the
  //   real users in Supabase.
  // After:  we keep the prop as an initial fallback (so the UI isn't blank
  //   during the fetch) but then replace it with the real users we load from
  //   Supabase in the useEffect below.
  // -------------------------------------------------------------------------
  const [accounts, setAccounts] = useState(accountsProp);

  // -------------------------------------------------------------------------
  // FIX #3: Actually fetch users from Supabase when the page loads
  // -------------------------------------------------------------------------
  // `usersService.getAll()` runs a SELECT * FROM profiles in Supabase. We then
  // map each row into our camelCase UI shape and store them in state.
  // The `cancelled` flag protects against setting state on an unmounted page
  // (e.g. if the admin navigates away while the request is still in-flight).
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profiles = await usersService.getAll();
        if (!cancelled) {
          setAccounts(profiles.map(mapProfileToAccount));
        }
      } catch (err) {
        console.error("Failed to load accounts from Supabase:", err);
        onShowToast?.({
          title: "Could not load accounts",
          description: err.message || "Please try again.",
          type: "error",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // FIX #4: Persist every account change to Supabase (not just local state)
  // -------------------------------------------------------------------------
  // This helper is reused by edit, deactivate, and activate. Steps:
  //   1. Update the UI immediately (optimistic update) so the admin sees the
  //      change without waiting for the network.
  //   2. Call `usersService.update(...)` which issues an UPDATE on the
  //      `profiles` row in Supabase. Supabase's RLS policy only lets admins
  //      perform this update.
  //   3. If it succeeds, also call onUpdateAccount() so App.jsx's copy of the
  //      accounts stays in sync.
  //   4. If it fails, log the error and show an error toast.
  // -------------------------------------------------------------------------
  const persistAccountUpdate = async (accountId, updates) => {
    // 1) Optimistic UI update
    setAccounts((prev) =>
      prev.map((account) =>
        account.id === accountId ? { ...account, ...updates } : account,
      ),
    );

    try {
      // 2) Persist to Supabase
      await usersService.update(accountId, mapUpdatesToProfile(updates));
      // 3) Keep parent state in sync
      onUpdateAccount?.(accountId, updates);
      return true;
    } catch (err) {
      // 4) Report failure to the admin
      console.error("Failed to update account in Supabase:", err);
      onShowToast?.({
        title: "Could not save changes",
        description: err.message || "Please try again.",
        type: "error",
      });
      return false;
    }
  };

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesSearch =
        normalizedSearch === "" ||
        account.username.toLowerCase().includes(normalizedSearch) ||
        account.fullName.toLowerCase().includes(normalizedSearch) ||
        account.email.toLowerCase().includes(normalizedSearch) ||
        account.role.toLowerCase().includes(normalizedSearch) ||
        account.status.toLowerCase().includes(normalizedSearch);

      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || account.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, roleFilter, searchTerm, statusFilter]);

  const openEditModal = (account) => {
    setEditTarget(account);
    setEditForm({
      username: account.username,
      fullName: account.fullName,
      email: account.email,
      password: "",
      confirmPassword: "",
      role: account.role,
    });
    setEditErrors({});
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setEditForm(EMPTY_EDIT_FORM);
    setEditErrors({});
  };

  const handleEditFieldChange = (event) => {
    const { name, value } = event.target;

    if (name === "role") {
      setEditForm((prev) => ({
        ...prev,
        role: value,
        username: updateUsernamePrefix(prev.username, value),
      }));
      return;
    }

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveChanges = () => {
    const nextErrors = {};
    const normalizedUsername = editForm.username.trim().toLowerCase();

    if (!normalizedUsername) {
      nextErrors.username = "Username is required.";
    } else if (!/^(enc|adm)_[a-z0-9_]+$/.test(normalizedUsername)) {
      nextErrors.username =
        "Use a username like enc_jdelacruz or adm_jdelacruz.";
    } else if (
      (editForm.role === "encoder" && !normalizedUsername.startsWith("enc_")) ||
      (editForm.role === "admin" && !normalizedUsername.startsWith("adm_"))
    ) {
      nextErrors.username =
        editForm.role === "encoder"
          ? "Encoder accounts must use the enc_ prefix."
          : "Admin accounts must use the adm_ prefix.";
    } else if (
      accounts.some(
        (account) =>
          account.id !== editTarget?.id && account.username === normalizedUsername,
      )
    ) {
      nextErrors.username = "This username is already assigned to another account.";
    }

    if (!editForm.fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }

    if (!editForm.email.trim()) {
      nextErrors.email = "Email is required.";
    }

    if (editForm.password || editForm.confirmPassword) {
      if (editForm.password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters.";
      }

      if (editForm.password !== editForm.confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors);
      return;
    }

    // FIX #4 (edit): save the edit to Supabase via persistAccountUpdate.
    (async () => {
      const ok = await persistAccountUpdate(editTarget.id, {
        username: normalizedUsername,
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      });

      if (ok) {
        onShowToast?.({
          title: "Account updated",
          description: `${editForm.fullName.trim()} was updated successfully.`,
          type: "success",
        });
        closeEditModal();
      }
    })();
  };

  // FIX #4 (deactivate): save the status change to Supabase.
  const handleDeactivate = async () => {
    if (!deactivateTarget) return;

    const ok = await persistAccountUpdate(deactivateTarget.id, {
      status: "deactivated",
    });

    if (ok) {
      onShowToast?.({
        title: "Account deactivated",
        description: `${deactivateTarget.fullName} can no longer sign in.`,
        type: "success",
      });
      setDeactivateTarget(null);
    }
  };

  // FIX #4 (activate): save the status change to Supabase.
  const handleActivate = async (accountId) => {
    const target = accounts.find((account) => account.id === accountId);

    const ok = await persistAccountUpdate(accountId, {
      status: "active",
    });

    if (ok && target) {
      onShowToast?.({
        title: "Account activated",
        description: `${target.fullName} can sign in again.`,
        type: "success",
      });
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Manage Accounts
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review, edit, and deactivate user accounts for the AWPB system.
        </p>
      </div>

      <Card className="overflow-hidden border-0 shadow-[0_10px_24px_rgba(15,23,42,0.08)] gap-0 py-0">
        <CardHeader className="border-b bg-white px-6 pt-5 pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-2xl">List of All Created Users</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Manage account access, roles, and active status.
              </p>
              <p className="mt-6 text-sm text-slate-500">
                Showing {filteredAccounts.length} of {accounts.length} accounts
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <div className="relative min-w-[300px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search username, user, email, role, or status"
                  className="pl-9"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="encoder">Encoder</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
              </select>

              <Button variant="outline" onClick={resetFilters}>
                Reset
              </Button>

              <Button
                asChild
                className="border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] text-white shadow-[0_6px_16px_rgba(31,47,116,0.28)] transition-all duration-200 hover:from-[#19265f] hover:to-[#213a80] hover:shadow-[0_10px_24px_rgba(31,47,116,0.38)]"
              >
                <Link to="/admin/manage-accounts/new">
                  <UserPlus size={16} />
                  Add User
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredAccounts.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No accounts match the current search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[17%]" />
                  <col className="w-[22%]" />
                  <col className="w-[23%]" />
                  <col className="w-[11%]" />
                  <col className="w-[10%]" />
                  <col className="w-[17%]" />
                </colgroup>

                <thead className="bg-slate-50 text-left">
                  <tr className="border-b">
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Username
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Full Name
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Email
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Role
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-700">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr key={account.id} className="border-b last:border-b-0">
                      <td className="px-4 py-4 text-slate-700">
                        {account.username}
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">
                          {account.fullName}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-slate-700">{account.email}</td>

                      <td className="px-4 py-4">
                        <Badge variant={getRoleBadgeVariant(account.role)}>
                          {account.role === "admin" ? "Admin" : "Encoder"}
                        </Badge>
                      </td>

                      <td className="px-4 py-4">
                        <Badge variant={getStatusBadgeVariant(account.status)}>
                          {account.status === "active" ? "Active" : "Deactivated"}
                        </Badge>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openEditModal(account)}
                            className="shrink-0 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            <Pencil size={15} />
                            Edit
                          </Button>

                          {account.status === "active" ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setDeactivateTarget(account)}
                              className="shrink-0 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            >
                              <UserX size={15} />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleActivate(account.id)}
                              className="shrink-0 border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            >
                              <RotateCcw size={15} />
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AdminEditUserModal
        open={Boolean(editTarget)}
        onOpenChange={(open) => !open && closeEditModal()}
        form={editForm}
        errors={editErrors}
        onFieldChange={handleEditFieldChange}
        onSave={handleSaveChanges}
      />

      <AdminDeactivateUserModal
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        user={deactivateTarget}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}

function updateUsernamePrefix(username, role) {
  const normalized = String(username || "").trim().toLowerCase();
  const nextPrefix = role === "admin" ? "adm_" : "enc_";

  if (!normalized) {
    return nextPrefix;
  }

  if (normalized.startsWith("enc_") || normalized.startsWith("adm_")) {
    return `${nextPrefix}${normalized.split("_").slice(1).join("_")}`;
  }

  return `${nextPrefix}${normalized.replace(/[^a-z0-9_]/g, "")}`;
}
