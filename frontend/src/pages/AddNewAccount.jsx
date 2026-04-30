import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const EMPTY_FORM = {
  username: "enc_",
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "encoder",
};

export default function AddNewAccount({
  accounts = [],
  onAddAccount,
  onShowToast,
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    if (name === "role") {
      setForm((prev) => ({
        ...prev,
        role: value,
        username: updateUsernamePrefix(prev.username, value),
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
//changes
  const handleCancel = () => {
  navigate("/admin/manage-accounts");
};

  const handleSave = async () => {
  const nextErrors = {};
  const normalizedUsername = form.username.trim().toLowerCase();

  if (!normalizedUsername) {
    nextErrors.username = "Username is required.";
  } else if (!/^(enc|adm)_[a-z0-9_]+$/.test(normalizedUsername)) {
    nextErrors.username =
      "Use a username like enc_jdelacruz or adm_jdelacruz.";
  } else if (
    (form.role === "encoder" && !normalizedUsername.startsWith("enc_")) ||
    (form.role === "admin" && !normalizedUsername.startsWith("adm_"))
  ) {
    nextErrors.username =
      form.role === "encoder"
        ? "Encoder accounts must use the enc_ prefix."
        : "Admin accounts must use the adm_ prefix.";
  } else if (
    accounts.some((account) => account.username === normalizedUsername)
  ) {
    nextErrors.username =
      "This username is already assigned to another account.";
  }

  if (!form.fullName.trim()) {
    nextErrors.fullName = "Full name is required.";
  }

  if (!form.email.trim()) {
    nextErrors.email = "Email is required.";
  }

  if (!form.password) {
    nextErrors.password = "Password is required.";
  } else if (form.password.length < 8) {
    nextErrors.password = "Password must be at least 8 characters.";
  }

  if (!form.confirmPassword) {
    nextErrors.confirmPassword = "Please confirm the password.";
  } else if (form.password !== form.confirmPassword) {
    nextErrors.confirmPassword = "Passwords do not match.";
  }

  setErrors(nextErrors);

  if (Object.keys(nextErrors).length === 0) {
    const createdName = form.fullName.trim();

    // CREATE AUTH USER (changes)
     const { data: authData, error: authError } =
      await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

    if (authError) {
      setErrors({ email: authError.message });
      return;
    }

    const userId = authData.user?.id;

    // INSERT INTO DATABASE TABLE (changes)
    const { error: dbError } = await supabase.from("profiles").insert([
      {
        id: userId,
        username: normalizedUsername, // example: enc_jdelacruz
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        role: form.role,
        status: "active",
      },
    ]);

    if (dbError) {
      setErrors({ email: dbError.message });
      return;
    }

    // KEEP ORIGINAL UI LOGIC (changes)
    onAddAccount?.({
      id: userId,
      username: normalizedUsername,
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      role: form.role,
      status: "active",
    });

    onShowToast?.({
      title: "Account created",
      description: `${createdName} was added to All Accounts.`,
      type: "success",
    });

    navigate("/admin/manage-accounts");
  }
};
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Add New Users
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a new encoder or admin account for the AWPB system.
        </p>
      </div>

      <Card className="overflow-hidden border-0 shadow-[0_10px_24px_rgba(15,23,42,0.08)] gap-0 py-0">
        <CardHeader className="border-b bg-white px-6 pt-5 pb-4 md:px-8">
          <CardTitle className="text-2xl">Create New User Account</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Fill in the account details and assign the proper role-specific
            username.
          </p>
        </CardHeader>

        <CardContent className="px-6 py-6 md:px-8 md:py-7">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:gap-10">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Username
                </label>
                <Input
                  name="username"
                  value={form.username}
                  onChange={handleFieldChange}
                  placeholder="enc_jdelacruz"
                  className="h-11 rounded-xl border-slate-200 bg-white px-4"
                />
                {errors.username && (
                  <p className="mt-1 text-xs text-red-600">{errors.username}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Full Name
                </label>
                <Input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleFieldChange}
                  placeholder="Enter full name"
                  className="h-11 rounded-xl border-slate-200 bg-white px-4"
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email
                </label>
                <Input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleFieldChange}
                  placeholder="Enter email"
                  className="h-11 rounded-xl border-slate-200 bg-white px-4"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <Input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleFieldChange}
                  placeholder="New password"
                  className="h-11 rounded-xl border-slate-200 bg-white px-4"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">{errors.password}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Confirm Password
                </label>
                <Input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleFieldChange}
                  placeholder="Confirm password"
                  className="h-11 rounded-xl border-slate-200 bg-white px-4"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Role
                </label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleFieldChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="admin">Admin</option>
                  <option value="encoder">Encoder</option>
                </select>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 xl:min-h-[230px]">
                <p className="text-sm font-semibold text-slate-800">
                  Account Notes
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Use `enc_` for encoder accounts and `adm_` for admin
                  accounts. Usernames should stay unique and role-specific to
                  preserve separate access for submission and review work.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleCancel} className="rounded-lg">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="rounded-lg border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] px-5 text-white hover:from-[#19265f] hover:to-[#213a80]"
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
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
