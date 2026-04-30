import { useEffect, useMemo, useState } from "react";
import { Search, Eye, Trash2 } from "lucide-react";

import AdminEntryReviewModal from "../components/admin/AdminEntryReviewModal";
import AdminDeleteEntryModal from "../components/admin/AdminDeleteEntryModal";

// === CONNECTING TO SUPABASE ===
// We use entriesService to save admin actions (approve / return / reject /
// delete) directly to the database, so the encoder sees them after refresh.
// We also use the supabase client directly to read the admin_entry_view,
// which already joins the names (unit, component, etc.) so we don't need to
// look them up ourselves.
import { supabase } from "../lib/supabase";
import { entriesService } from "../services/supabaseService";

// ---------------------------------------------------------------------------
// The database speaks snake_case (title_of_activities). The UI speaks
// camelCase (titleOfActivities). This helper translates one row from the
// admin_entry_view into the shape the rest of this page expects.
// ---------------------------------------------------------------------------
function transformViewRow(row) {
  if (!row) return row;

  // Some rows store the monthly breakdown as a JSON array. We convert it
  // into the shape the table preview / modal expect.
  const monthlyBreakdown = Array.isArray(row.monthly_breakdown)
    ? row.monthly_breakdown.map((m) => ({
        month: m.month,
        target: m.target_quantity ?? m.target ?? 0,
        amount: (m.target_quantity ?? m.target ?? 0) * (row.unit_cost || 0),
      }))
    : [];

  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerUsername: row.owner_username || "",
    ownerFullName: row.owner_full_name || "",
    planningYear: row.planning_year,
    unit: row.unit,
    component: row.component,
    subComponent: row.sub_component,
    keyActivity: row.key_activity,
    no: row.activity_no ?? "",
    performanceIndicator: row.performance_indicator || "",
    subActivity: row.sub_activity || "",
    titleOfActivities: row.title_of_activities,
    unitCost: Number(row.unit_cost) || 0,
    status: row.status,
    adminComment: row.reviewer_notes || row.admin_comment || "",
    submittedAt: row.submitted_at || row.submission_date || "",
    reviewedAt: row.reviewed_at || row.review_date || "",
    monthlyBreakdown,
    grandTotal: Number(row.grand_total) || 0,
  };
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value) {
  if (!value) return "N/A";

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusBadgeVariant(status) {
  switch (status) {
    case "Pending Review":
      return "statusPending";
    case "Returned":
      return "statusReturned";
    case "Approved":
      return "statusApproved";
    case "Rejected":
      return "statusRejected";
    default:
      return "outline";
  }
}

export default function AdminReview({
  entries: entriesProp = [],
  onUpdateEntry,
  onDeleteEntry,
  onShowToast,
}) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  // -------------------------------------------------------------------------
  // Load the real list of entries from Supabase when the page opens.
  //
  // Steps:
  //   1. Ask Supabase for all entries (entriesService.getAll() automatically
  //      returns everyone's entries because we're logged in as admin).
  //   2. Save them in local state so the table shows real data.
  //   3. While the network request is in flight, we fall back to whatever
  //      the parent App.jsx passed in, so the page is never blank.
  //   4. If anything fails, show an error toast.
  // -------------------------------------------------------------------------
  const [supabaseEntries, setSupabaseEntries] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Query admin_entry_view directly because it already includes the
        // joined names (unit, component, sub_component, key_activity) plus
        // the computed grand_total and monthly_breakdown.
        const { data, error } = await supabase
          .from("admin_entry_view")
          .select("*")
          .order("submitted_at", { ascending: false });

        if (error) throw error;

        // Translate every snake_case row into the camelCase shape the rest
        // of the page expects.
        const translated = (data || []).map(transformViewRow);
        if (!cancelled) setSupabaseEntries(translated);
      } catch (err) {
        console.error("Failed to load entries from Supabase:", err);
        if (!cancelled) {
          onShowToast?.({
            title: "Could not load entries",
            description: err.message || "Please refresh the page.",
            type: "error",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onShowToast]);

  // Use live Supabase data when it's ready; otherwise fall back to the prop.
  const entries = supabaseEntries ?? entriesProp;

  const availableUnits = useMemo(() => {
    return [...new Set(entries.map((entry) => entry.unit).filter(Boolean))].sort();
  }, [entries]);

  const availableYears = useMemo(() => {
    return [...new Set(entries.map((entry) => entry.planningYear).filter(Boolean))]
      .sort((a, b) => String(b).localeCompare(String(a)));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesSearch =
        normalizedSearch === "" ||
        entry.titleOfActivities?.toLowerCase().includes(normalizedSearch) ||
        entry.performanceIndicator?.toLowerCase().includes(normalizedSearch) ||
        entry.subActivity?.toLowerCase().includes(normalizedSearch) ||
        entry.unit?.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || entry.status === statusFilter;

      const matchesUnit = unitFilter === "all" || entry.unit === unitFilter;

      const matchesYear =
        yearFilter === "all" || String(entry.planningYear) === yearFilter;

      return matchesSearch && matchesStatus && matchesUnit && matchesYear;
    });
  }, [entries, searchTerm, statusFilter, unitFilter, yearFilter]);

  // -------------------------------------------------------------------------
  // Shared helper used by Approve / Return / Reject.
  //
  // Steps:
  //   1. Translate the UI fields (status, adminComment, reviewedAt) into the
  //      database column names (status, reviewer_notes, review_date).
  //   2. Send the update to Supabase.
  //   3. Also update the local list so the admin sees the change instantly.
  //   4. Show the success toast.
  // If anything fails, we show an error toast and do NOT close the modal so
  // the admin can try again.
  // -------------------------------------------------------------------------
  const persistEntryUpdate = async (entryId, uiUpdates, successToast) => {
    // Translate UI field names -> Supabase column names
    const dbUpdates = {
      status: uiUpdates.status,
      reviewer_notes: uiUpdates.adminComment ?? "",
      review_date: uiUpdates.reviewedAt,
    };

    try {
      // Save to Supabase and capture the refreshed row
      const updatedEntry = await entriesService.update(entryId, dbUpdates);

      // Keep the local list (in App.jsx) in sync using the full entry row
      onUpdateEntry?.(entryId, updatedEntry);

      onShowToast?.(successToast);
      setSelectedEntry(null);
    } catch (err) {
      console.error("Failed to update entry in Supabase:", err);
      onShowToast?.({
        title: "Could not save changes",
        description: err.message || "Please try again.",
        type: "error",
      });
    }
  };

  const handleApprove = (note) => {
    if (!selectedEntry) return;
    const entryTitle = selectedEntry.titleOfActivities;
    persistEntryUpdate(
      selectedEntry.id,
      {
        status: "Approved",
        adminComment: note || "",
        reviewedAt: new Date().toISOString(),
      },
      {
        title: "Entry approved",
        description: `${entryTitle} was approved successfully.`,
        type: "success",
      },
    );
  };

  const handleReturn = (note) => {
    if (!selectedEntry) return;
    const entryTitle = selectedEntry.titleOfActivities;
    persistEntryUpdate(
      selectedEntry.id,
      {
        status: "Returned",
        adminComment: note,
        reviewedAt: new Date().toISOString(),
      },
      {
        title: "Entry returned",
        description: `${entryTitle} was returned for revision.`,
        type: "success",
      },
    );
  };

  const handleReject = (note) => {
    if (!selectedEntry) return;
    const entryTitle = selectedEntry.titleOfActivities;
    persistEntryUpdate(
      selectedEntry.id,
      {
        status: "Rejected",
        adminComment: note,
        reviewedAt: new Date().toISOString(),
      },
      {
        title: "Entry rejected",
        description: `${entryTitle} was rejected.`,
        type: "success",
      },
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setUnitFilter("all");
    setYearFilter("all");
  };

  // -------------------------------------------------------------------------
  // Delete an entry permanently. Asks Supabase to remove the row, then also
  // removes it from the local list so the admin sees it disappear instantly.
  // -------------------------------------------------------------------------
  const handleDelete = async () => {
    if (!deleteTarget) return;

    const entryTitle = deleteTarget.titleOfActivities;

    try {
      // Delete from Supabase first
      await entriesService.delete(deleteTarget.id);

      // Then remove it from the local list
      onDeleteEntry?.(deleteTarget.id);

      onShowToast?.({
        title: "Entry deleted",
        description: `${entryTitle} was removed successfully.`,
        type: "success",
      });

      if (selectedEntry?.id === deleteTarget.id) {
        setSelectedEntry(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete entry from Supabase:", err);
      onShowToast?.({
        title: "Could not delete entry",
        description: err.message || "Please try again.",
        type: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Admin Review
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review submitted AWPB entries and update their status.
        </p>
      </div>

      <Card className="overflow-hidden border-0 shadow-[0_10px_24px_rgba(15,23,42,0.08)] gap-0 py-0">
        <CardHeader className="border-b bg-white px-6 pt-5 pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-2xl">All Submitted Entries</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Search and filter submissions for admin review.
              </p>
              <p className="mt-6 text-sm text-slate-500">
                Showing {filteredEntries.length} of {entries.length} entries
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
              <div className="relative w-full sm:min-w-[300px] sm:flex-1 xl:max-w-[340px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search title, sub activity, or unit"
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending Review">Pending Review</SelectItem>
                  <SelectItem value="Returned">Returned</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto">
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No entries match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                  <col className="w-[13%]" />
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                </colgroup>

                <thead className="bg-slate-50 text-left">
                  <tr className="border-b">
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Title
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Unit
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Year
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Submitted
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-700">
                      Total
                    </th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-700">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-b-0">
                      <td className="px-4 py-4">
                        <p
                          className="truncate font-medium text-slate-900"
                          title={entry.titleOfActivities}
                        >
                          {entry.titleOfActivities}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-slate-700">{entry.unit}</td>
                      <td className="px-4 py-4 text-slate-700">
                        {entry.planningYear || "N/A"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDate(entry.submittedAt)}
                      </td>

                      <td className="px-4 py-4">
                        <Badge variant={getStatusBadgeVariant(entry.status)}>
                          {entry.status}
                        </Badge>
                      </td>

                      <td className="px-4 py-4 text-right font-medium text-slate-900">
                        {formatCurrency(entry.grandTotal)}
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSelectedEntry(entry)}
                            title="Review entry"
                            aria-label="Review entry"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Eye />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(entry)}
                            title="Delete entry"
                            aria-label="Delete entry"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 />
                          </Button>
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

      <AdminEntryReviewModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onApprove={handleApprove}
        onReturn={handleReturn}
        onReject={handleReject}
      />

      <AdminDeleteEntryModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        entry={deleteTarget}
        onConfirm={handleDelete}
      />
    </div>
  );
}
