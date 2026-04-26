import { useMemo, useState } from "react";
import { Search, Eye, Trash2 } from "lucide-react";

import AdminEntryReviewModal from "../components/admin/AdminEntryReviewModal";
import AdminDeleteEntryModal from "../components/admin/AdminDeleteEntryModal";

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
  entries = [],
  onUpdateEntry,
  onDeleteEntry,
  onShowToast,
  isLoading = false,
}) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

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

  const handleApprove = async (note) => {
    if (!selectedEntry) return;

    const entryTitle = selectedEntry.titleOfActivities;
    try {
      await onUpdateEntry(selectedEntry.id, {
        status: "Approved",
        adminComment: note || "",
        reviewedAt: new Date().toISOString(),
      });

      onShowToast?.({
        title: "Entry approved",
        description: `${entryTitle} was approved successfully.`,
        type: "success",
      });

      setSelectedEntry(null);
    } catch (error) {
      onShowToast?.({
        title: "Unable to approve entry",
        description:
          error?.message || "The approval could not be saved. Please try again.",
        type: "error",
      });
    }
  };

  const handleReturn = async (note) => {
    if (!selectedEntry) return;

    const entryTitle = selectedEntry.titleOfActivities;
    try {
      await onUpdateEntry(selectedEntry.id, {
        status: "Returned",
        adminComment: note,
        reviewedAt: new Date().toISOString(),
      });

      onShowToast?.({
        title: "Entry returned",
        description: `${entryTitle} was returned for revision.`,
        type: "success",
      });

      setSelectedEntry(null);
    } catch (error) {
      onShowToast?.({
        title: "Unable to return entry",
        description:
          error?.message || "The return action could not be saved. Please try again.",
        type: "error",
      });
    }
  };

  const handleReject = async (note) => {
    if (!selectedEntry) return;

    const entryTitle = selectedEntry.titleOfActivities;
    try {
      await onUpdateEntry(selectedEntry.id, {
        status: "Rejected",
        adminComment: note,
        reviewedAt: new Date().toISOString(),
      });

      onShowToast?.({
        title: "Entry rejected",
        description: `${entryTitle} was rejected.`,
        type: "success",
      });

      setSelectedEntry(null);
    } catch (error) {
      onShowToast?.({
        title: "Unable to reject entry",
        description:
          error?.message || "The rejection could not be saved. Please try again.",
        type: "error",
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setUnitFilter("all");
    setYearFilter("all");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const entryTitle = deleteTarget.titleOfActivities;
    try {
      await onDeleteEntry?.(deleteTarget.id);
      onShowToast?.({
        title: "Entry deleted",
        description: `${entryTitle} was removed successfully.`,
        type: "success",
      });

      if (selectedEntry?.id === deleteTarget.id) {
        setSelectedEntry(null);
      }

      setDeleteTarget(null);
    } catch (error) {
      onShowToast?.({
        title: "Unable to delete entry",
        description:
          error?.message || "The entry could not be deleted. Please try again.",
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
          {isLoading ? (
            <div className="p-6 text-sm text-slate-500">
              Loading submissions...
            </div>
          ) : filteredEntries.length === 0 ? (
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
