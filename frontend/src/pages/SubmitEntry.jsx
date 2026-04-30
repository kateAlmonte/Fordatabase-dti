import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// === SUPABASE INTEGRATION (dropdowns only) ===
// We load the AWPB template hierarchy and unit list from Supabase so the
// dropdowns show live data that admins can edit through Manage Template.
// The JSON file passed in via `templateData` is still used as a fallback
// until the network request finishes (and as a safety net if it fails).
import { templateService } from "../services/supabaseService";

const FALLBACK_VALUE = "N/A";

// ---------------------------------------------------------------------------
// Reshape the flat `template_hierarchy` rows from Supabase into the nested
// object the form already knows how to render:
//   {
//     "Component name": {
//       "Sub component name": {
//         "Key activity name": [
//           { no, performanceIndicator, subActivities: [...] }
//         ]
//       }
//     }
//   }
// ---------------------------------------------------------------------------
function buildTemplateDataFromSupabase(hierarchyRows, unitRows) {
  const hierarchy = {};

  for (const row of hierarchyRows || []) {
    const { component, sub_component, key_activity, activity_no,
      performance_indicator, sub_activity } = row;
    if (!component) continue;

    // Ensure nested containers exist
    if (!hierarchy[component]) hierarchy[component] = {};
    if (!sub_component) continue;
    if (!hierarchy[component][sub_component]) hierarchy[component][sub_component] = {};
    if (!key_activity) continue;
    if (!hierarchy[component][sub_component][key_activity]) {
      hierarchy[component][sub_component][key_activity] = [];
    }

    // Find or create the activity-number entry (grouped by `no`)
    const bucket = hierarchy[component][sub_component][key_activity];
    let entry = bucket.find((item) => String(item.no) === String(activity_no));
    if (!entry) {
      entry = {
        no: activity_no,
        performanceIndicator: performance_indicator || "",
        subActivities: [],
      };
      bucket.push(entry);
    }

    // Add sub-activity if present and not already tracked
    if (sub_activity && !entry.subActivities.includes(sub_activity)) {
      entry.subActivities.push(sub_activity);
    }
  }

  const unitOptions = (unitRows || []).map((u) => ({
    value: u.code || u.name,
    aliases: [u.name, u.code].filter(Boolean),
  }));

  return { hierarchy, unitOptions };
}

const MONTHS = [
  { key: "jan", label: "Jan" },
  { key: "feb", label: "Feb" },
  { key: "mar", label: "Mar" },
  { key: "apr", label: "Apr" },
  { key: "may", label: "May" },
  { key: "jun", label: "Jun" },
  { key: "jul", label: "Jul" },
  { key: "aug", label: "Aug" },
  { key: "sep", label: "Sep" },
  { key: "oct", label: "Oct" },
  { key: "nov", label: "Nov" },
  { key: "dec", label: "Dec" },
];

const CURRENT_YEAR = new Date().getFullYear();

const defaultFormValues = {
  planningYear: String(CURRENT_YEAR),
  unit: "",
  component: "",
  subComponent: "",
  keyActivity: "",
  no: "",
  performanceIndicator: "",
  subActivity: "",
  titleOfActivities: "",
  unitCost: "",
  targets: {
    jan: "",
    feb: "",
    mar: "",
    apr: "",
    may: "",
    jun: "",
    jul: "",
    aug: "",
    sep: "",
    oct: "",
    nov: "",
    dec: "",
  },
};

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDateOnly(value) {
  if (!value) return "N/A";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildFormValuesFromEntry(entry) {
  const targets = MONTHS.reduce((acc, month) => {
    const found = entry.monthlyBreakdown?.find(
      (row) => row.month === month.label,
    );
    acc[month.key] = found ? found.target : "";
    return acc;
  }, {});

  return {
    planningYear: entry.planningYear || String(CURRENT_YEAR),
    unit: entry.unit || "",
    component: entry.component || "",
    subComponent: entry.subComponent || "",
    keyActivity: entry.keyActivity || "",
    no: entry.no ? String(entry.no) : "",
    performanceIndicator: entry.performanceIndicator || "",
    subActivity: entry.subActivity || "",
    titleOfActivities: entry.titleOfActivities || "",
    unitCost: entry.unitCost ?? "",
    targets,
  };
}

function isSubmissionWindowOpen(submissionWindow) {
  const { startDate, endDate } = submissionWindow || {};

  if (!startDate || !endDate) return false;

  const today = new Date();
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  return today >= start && today <= end;
}

export default function SubmitEntry({
  onAddEntry,
  entryToEdit,
  onSaveEditedEntry,
  clearEditingEntry,
  submissionWindow,
  draftState,
  onDraftChange,
  onClearDraft,
  currentUser,
  templateData: templateDataProp,
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // -------------------------------------------------------------------------
  // Load dropdown data from Supabase. Uses the JSON prop as an initial
  // fallback so the form is never blank while the network request is in
  // flight. Once Supabase responds, we replace the data with the live one.
  // -------------------------------------------------------------------------
  const [supabaseTemplateData, setSupabaseTemplateData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hierarchyRows, unitRows] = await Promise.all([
          templateService.getHierarchy(),
          templateService.getUnits(),
        ]);
        if (!cancelled) {
          setSupabaseTemplateData(
            buildTemplateDataFromSupabase(hierarchyRows, unitRows),
          );
        }
      } catch (err) {
        console.error("Failed to load template data from Supabase:", err);
        // Fall back to the JSON prop silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer Supabase data when available; otherwise use the JSON prop.
  const templateData = supabaseTemplateData || templateDataProp;

  const {
    control,
    register,
    handleSubmit,
    watch,
    trigger,
    reset,
    resetField,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: defaultFormValues,
  });

  const planningYears = Array.from({ length: 5 }, (_, index) =>
    String(CURRENT_YEAR + index),
  );
  const isEditingReturnedEntry =
    entryToEdit && entryToEdit.status === "Returned";

  const windowOpen = isSubmissionWindowOpen(submissionWindow);
  const formLocked = !windowOpen;

  const planningYear = watch("planningYear");
  const unit = watch("unit");
  const component = watch("component");
  const subComponent = watch("subComponent");
  const keyActivity = watch("keyActivity");
  const selectedNo = watch("no");
  const watchedSubActivity = watch("subActivity");
  const titleOfActivities = watch("titleOfActivities");

  const unitCost = useWatch({
    control,
    name: "unitCost",
  });

  const targets =
    useWatch({
      control,
      name: "targets",
    }) || {};

  const draftValues = useWatch({
    control,
  });

  const unitOptions = useMemo(() => {
    return (templateData?.unitOptions || []).map((item) => item.value);
  }, [templateData]);

  const componentOptions = useMemo(() => {
    return Object.keys(templateData?.hierarchy || {});
  }, [templateData]);

  const currentComponentNode = useMemo(() => {
    return templateData?.hierarchy?.[component] || null;
  }, [component, templateData]);

  const rawSubComponentKeys = useMemo(() => {
    if (!component) return [];
    return Object.keys(currentComponentNode || {});
  }, [component, currentComponentNode]);

  const hasNoSubComponent =
    rawSubComponentKeys.length === 1 && rawSubComponentKeys[0] === "";

  const visibleSubComponentOptions = useMemo(() => {
    return rawSubComponentKeys.filter((key) => key !== "");
  }, [rawSubComponentKeys]);

  const subComponentKey = subComponent === FALLBACK_VALUE ? "" : subComponent;

  const keyActivityOptions = useMemo(() => {
    if (!component) return [];
    return Object.keys(
      templateData?.hierarchy?.[component]?.[subComponentKey] || {},
    );
  }, [component, subComponentKey, templateData]);

  const noOptions = useMemo(() => {
    if (!component || !keyActivity) return [];
    return (
      templateData?.hierarchy?.[component]?.[subComponentKey]?.[keyActivity] || []
    );
  }, [component, subComponentKey, keyActivity, templateData]);

  const selectedNoEntry = useMemo(() => {
    return noOptions.find((item) => String(item.no) === String(selectedNo));
  }, [noOptions, selectedNo]);

  const subActivityOptions = useMemo(() => {
    return selectedNoEntry?.subActivities || [];
  }, [selectedNoEntry]);

  const hasNoSubActivity =
    Boolean(selectedNo) && subActivityOptions.length === 0;

  const monthlyRows = useMemo(() => {
    const parsedUnitCost = toNumber(unitCost);

    return MONTHS.map((month) => {
      const target = toNumber(targets[month.key]);
      const amount = parsedUnitCost * target;

      return {
        ...month,
        target,
        amount,
      };
    });
  }, [unitCost, targets]);

  const activeMonthlyRows = useMemo(() => {
    return monthlyRows.filter((row) => row.target > 0);
  }, [monthlyRows]);

  const grandTotal = useMemo(() => {
    return monthlyRows.reduce((sum, row) => sum + row.amount, 0);
  }, [monthlyRows]);

  useEffect(() => {
    if (entryToEdit && entryToEdit.status === "Returned") {
      const shouldUseEditDraft =
        draftState?.mode === "edit" && draftState?.entryId === entryToEdit.id;

      const nextValues = shouldUseEditDraft
        ? mergeWithDefaultFormValues(draftState?.values)
        : buildFormValuesFromEntry(entryToEdit);

      reset(nextValues);
      setStep(shouldUseEditDraft ? draftState?.step || 1 : 1);
      return;
    }

    if (draftState?.mode === "new" && draftState?.values) {
      reset(mergeWithDefaultFormValues(draftState.values));
      setStep(draftState?.step || 1);
      return;
    }

    reset(defaultFormValues);
    setStep(1);
  }, [entryToEdit, reset]);

  useEffect(() => {
    if (!draftValues) return;

    onDraftChange?.({
      mode:
        entryToEdit && entryToEdit.status === "Returned" ? "edit" : "new",
      entryId: entryToEdit?.id || null,
      step,
      values: mergeWithDefaultFormValues(draftValues),
    });
  }, [draftValues, entryToEdit, onDraftChange, step]);

  useEffect(() => {
    resetField("component");
    resetField("subComponent");
    resetField("keyActivity");
    resetField("no");
    resetField("performanceIndicator");
    resetField("subActivity");
  }, [unit, resetField]);

  useEffect(() => {
    resetField("subComponent");
    resetField("keyActivity");
    resetField("no");
    resetField("performanceIndicator");
    resetField("subActivity");

    if (component && hasNoSubComponent) {
      setValue("subComponent", FALLBACK_VALUE, {
        shouldValidate: true,
        shouldDirty: false,
      });
    }
  }, [component, hasNoSubComponent, resetField, setValue]);

  useEffect(() => {
    resetField("keyActivity");
    resetField("no");
    resetField("performanceIndicator");
    resetField("subActivity");
  }, [subComponent, resetField]);

  useEffect(() => {
    resetField("no");
    resetField("performanceIndicator");
    resetField("subActivity");
  }, [keyActivity, resetField]);

  useEffect(() => {
    setValue(
      "performanceIndicator",
      selectedNoEntry?.performanceIndicator || "",
      {
        shouldValidate: false,
        shouldDirty: false,
      },
    );

    if (!selectedNo) {
      resetField("subActivity");
      return;
    }

    if (hasNoSubActivity) {
      setValue("subActivity", FALLBACK_VALUE, {
        shouldValidate: true,
        shouldDirty: false,
      });
    } else if (watchedSubActivity === FALLBACK_VALUE) {
      setValue("subActivity", "", {
        shouldValidate: true,
        shouldDirty: false,
      });
    }
  }, [
    selectedNo,
    selectedNoEntry,
    hasNoSubActivity,
    watchedSubActivity,
    setValue,
    resetField,
  ]);

  const validateStep1 = async () => {
    return await trigger([
      "planningYear",
      "unit",
      "component",
      "subComponent",
      "keyActivity",
      "no",
      "performanceIndicator",
      "subActivity",
      "titleOfActivities",
    ]);
  };

  const validateStep2 = async () => {
    const targetFieldNames = MONTHS.map((month) => `targets.${month.key}`);

    const isValid = await trigger(["unitCost", ...targetFieldNames]);

    const hasAtLeastOneTarget = monthlyRows.some((row) => row.target > 0);

    if (!hasAtLeastOneTarget) {
      alert("Please enter at least one monthly target before continuing.");
      return false;
    }

    return isValid;
  };

  const handleStepClick = async (targetStep) => {
    if (formLocked) return;
    if (targetStep === step) return;

    if (targetStep === 1) {
      setStep(1);
      return;
    }

    if (targetStep === 2) {
      const step1Valid = await validateStep1();
      if (step1Valid) {
        setStep(2);
      }
      return;
    }

    if (targetStep === 3) {
      const step1Valid = await validateStep1();

      if (!step1Valid) {
        setStep(1);
        return;
      }

      const step2Valid = await validateStep2();

      if (step2Valid) {
        setStep(3);
      } else {
        setStep(2);
      }
    }
  };

  const goToStep1 = async () => {
    setStep(1);
  };

  const goToStep2 = async () => {
    if (formLocked) return;
    const isValid = await validateStep1();

    if (isValid) {
      setStep(2);
    }
  };

  const goToStep3 = async () => {
    if (formLocked) return;
    const isValid = await validateStep2();

    if (isValid) {
      setStep(3);
    }
  };

  const onSubmit = (data) => {
    if (!windowOpen) {
      alert(
        "The encoding period is closed. You cannot submit or resubmit entries right now.",
      );
      return;
    }

    const hasAtLeastOneTarget = monthlyRows.some((row) => row.target > 0);

    if (!hasAtLeastOneTarget) {
      alert("Please enter at least one monthly target before submitting.");
      setStep(2);
      return;
    }

    if (isEditingReturnedEntry) {
      const updatedEntry = {
        ...entryToEdit,
        ownerId: entryToEdit.ownerId || currentUser?.id || "",
        ownerUsername: entryToEdit.ownerUsername || currentUser?.username || "",
        ownerFullName:
          entryToEdit.ownerFullName || currentUser?.fullName || "",
        planningYear: data.planningYear,
        unit: data.unit,
        component: data.component,
        subComponent: data.subComponent,
        keyActivity: data.keyActivity,
        no: data.no,
        performanceIndicator: data.performanceIndicator,
        subActivity: data.subActivity,
        titleOfActivities: data.titleOfActivities,
        unitCost: toNumber(data.unitCost),
        monthlyBreakdown: monthlyRows.map((row) => ({
          month: row.label,
          target: row.target,
          amount: row.amount,
        })),
        grandTotal,
        status: "Pending Review",
        adminComment: "",
        reviewedAt: "",
        resubmittedAt: new Date().toISOString(),
      };

      onSaveEditedEntry(entryToEdit.id, updatedEntry);
      reset(defaultFormValues);
      setStep(1);
      onClearDraft?.();
      clearEditingEntry?.();
      navigate("/entries");
      return;
    }

    const newEntry = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),
      ownerId: currentUser?.id || "",
      ownerUsername: currentUser?.username || "",
      ownerFullName: currentUser?.fullName || "",
      planningYear: data.planningYear,
      unit: data.unit,
      component: data.component,
      subComponent: data.subComponent,
      keyActivity: data.keyActivity,
      no: data.no,
      performanceIndicator: data.performanceIndicator,
      subActivity: data.subActivity,
      titleOfActivities: data.titleOfActivities,
      unitCost: toNumber(data.unitCost),
      monthlyBreakdown: monthlyRows.map((row) => ({
        month: row.label,
        target: row.target,
        amount: row.amount,
      })),
      grandTotal,
      status: "Pending Review",
      adminComment: "",
      submittedAt: new Date().toISOString(),
    };

    onAddEntry(newEntry);
    reset(defaultFormValues);
    setStep(1);
    onClearDraft?.();
    clearEditingEntry?.();
    navigate("/entries");
  };

  const steps = [
    { number: 1, label: "Classification" },
    { number: 2, label: "Budget Computation" },
    { number: 3, label: "Review & Submit" },
  ];

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {isEditingReturnedEntry ? "Edit Returned Entry" : "Submit Entry"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete the AWPB entry in three guided steps.
        </p>
      </div>

      {!windowOpen && (
        <Card className="border-0 bg-gradient-to-br from-[#f9d1d1] via-[#f5bcbc] to-[#ef9f9f] shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-rose-900">
                  Encoding period is closed
                </p>
                <p className="text-sm text-rose-800">
                  New submissions and returned-entry edits are currently locked.
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  {formatDateOnly(submissionWindow?.startDate)} to{" "}
                  {formatDateOnly(submissionWindow?.endDate)}
                </p>
              </div>

              <Badge
                variant="outline"
                className="self-start border-rose-300 bg-white/40 text-rose-800 md:self-center"
              >
                Closed
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {isEditingReturnedEntry && entryToEdit?.adminComment && (
        <Card className="border-0 bg-amber-50 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
          <CardContent className="p-4">
            <h2 className="mb-2 font-medium text-amber-900">Revision Note</h2>
            <p className="text-sm text-amber-900">{entryToEdit.adminComment}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
        <CardContent className="p-6">
        <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          {steps.map((item) => {
            const isActive = step === item.number;
            const isDone = step > item.number;

            return (
              <button
                key={item.number}
                type="button"
                onClick={() => handleStepClick(item.number)}
                disabled={formLocked}
                className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-none ${
                  isActive
                    ? "border border-transparent bg-gradient-to-r from-[#1f2f74] to-[#2a4694] text-white"
                    : isDone
                      ? "border border-slate-300 bg-slate-100 text-slate-800"
                      : "border border-slate-200 bg-white text-slate-500"
                }`}
              >
                Step {item.number}: {item.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <fieldset
            disabled={formLocked}
            className={formLocked ? "space-y-8 opacity-70" : "space-y-8"}
          >
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Classification</h2>
                <p className="text-sm text-gray-500">
                  Select the hierarchy that matches the official AWPB structure.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Planning Year
                  </label>
                  <select
                    {...register("planningYear", {
                      required: "Planning Year is required",
                    })}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    {planningYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  {errors.planningYear && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.planningYear.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Unit</label>
                  <select
                    {...register("unit", {
                      required: "Unit is required",
                    })}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    <option value="">Select unit</option>
                    {unitOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {errors.unit && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.unit.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Component
                  </label>
                  <select
                    {...register("component", {
                      required: "Component is required",
                    })}
                    disabled={!unit}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-gray-300"
                  >
                    <option value="">Select component</option>
                    {componentOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {errors.component && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.component.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Sub component
                  </label>

                  {component && hasNoSubComponent ? (
                    <>
                      <input
                        type="hidden"
                        {...register("subComponent", {
                          required: "Sub component is required",
                        })}
                      />
                      <input
                        type="text"
                        readOnly
                        value={FALLBACK_VALUE}
                        className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-600 outline-none"
                      />
                    </>
                  ) : (
                    <select
                      {...register("subComponent", {
                        required: "Sub component is required",
                      })}
                      disabled={!component}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-gray-300"
                    >
                      <option value="">Select sub component</option>
                      {visibleSubComponentOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  )}

                  {errors.subComponent && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.subComponent.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Key Activity
                  </label>
                  <select
                    {...register("keyActivity", {
                      required: "Key Activity is required",
                    })}
                    disabled={
                      !component || (!hasNoSubComponent && !subComponent)
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-gray-300"
                  >
                    <option value="">Select key activity</option>
                    {keyActivityOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  {errors.keyActivity && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.keyActivity.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">No.</label>
                  <select
                    {...register("no", {
                      required: "No. is required",
                    })}
                    disabled={!keyActivity}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-gray-300"
                  >
                    <option value="">Select no.</option>
                    {noOptions.map((item) => (
                      <option key={item.no} value={String(item.no)}>
                        {item.no} - {item.performanceIndicator}
                      </option>
                    ))}
                  </select>
                  {errors.no && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.no.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Performance Indicator
                  </label>
                  <input
                    type="text"
                    placeholder="Will auto-fill after selecting No."
                    disabled={!selectedNo}
                    readOnly
                    {...register("performanceIndicator", {
                      required: "Performance Indicator is required",
                    })}
                    className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none"
                  />
                  {errors.performanceIndicator && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.performanceIndicator.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Sub Activity
                  </label>

                  {hasNoSubActivity ? (
                    <>
                      <input
                        type="hidden"
                        {...register("subActivity", {
                          required: "Sub Activity is required",
                        })}
                      />
                      <input
                        type="text"
                        readOnly
                        value={FALLBACK_VALUE}
                        className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-600 outline-none"
                      />
                    </>
                  ) : (
                    <select
                      {...register("subActivity", {
                        required: "Sub Activity is required",
                      })}
                      disabled={!selectedNo}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-gray-300"
                    >
                      <option value="">Select sub activity</option>
                      {subActivityOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  )}

                  {errors.subActivity && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.subActivity.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Title of Activities
                  </label>
                  <input
                    type="text"
                    placeholder="Enter title of activities"
                    {...register("titleOfActivities", {
                      required: "Title of Activities is required",
                    })}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  {errors.titleOfActivities && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.titleOfActivities.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                {isEditingReturnedEntry ? (
                  <Button
                    type="button"
                    onClick={() => {
                      onClearDraft?.();
                      clearEditingEntry?.();
                      navigate("/entries");
                    }}
                    variant="outline"
                    className="px-4 text-[15px]"
                  >
                    Cancel Edit
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      onClearDraft?.();
                      reset(defaultFormValues);
                      setStep(1);
                    }}
                    variant="outline"
                    className="px-4 text-[15px]"
                  >
                    Clear Form
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={goToStep2}
                  className="px-4 text-[15px] border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] text-white shadow-[0_6px_16px_rgba(31,47,116,0.28)] transition-all duration-200 hover:from-[#19265f] hover:to-[#213a80] hover:shadow-[0_10px_24px_rgba(31,47,116,0.38)]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Budget Computation</h2>
                <p className="text-sm text-gray-500">
                  Monthly amount is automatically computed as Unit Cost ×
                  Monthly Target.
                </p>
              </div>

              <div className="max-w-sm">
                <label className="mb-2 block text-sm font-medium">
                  Unit Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter unit cost"
                  {...register("unitCost", {
                    setValueAs: (value) => (value === "" ? "" : Number(value)),
                    required: "Unit Cost is required",
                    min: {
                      value: 0,
                      message: "Unit Cost cannot be negative",
                    },
                  })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                />
                {errors.unitCost && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.unitCost.message}
                  </p>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Month</th>
                      <th className="px-4 py-3 text-left font-medium">
                        Target
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Computed Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((row, index) => (
                      <tr
                        key={row.key}
                        className={index !== 0 ? "border-t" : ""}
                      >
                        <td className="px-4 py-3 font-medium">{row.label}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            {...register(`targets.${row.key}`, {
                              setValueAs: (value) =>
                                value === "" ? "" : Number(value),
                              min: {
                                value: 0,
                                message: "Target cannot be negative",
                              },
                            })}
                            className={`w-32 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                              errors.targets?.[row.key]
                                ? "border-red-400 focus:ring-red-200"
                                : "focus:ring-gray-300"
                            }`}
                          />
                          {errors.targets?.[row.key] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors.targets[row.key].message}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-gray-50">
                    <tr>
                      <td className="px-4 py-3 font-semibold" colSpan={2}>
                        Grand Total
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={goToStep1}
                  variant="outline"
                  className="px-4 text-[15px]"
                >
                  Back
                </Button>

                <Button
                  type="button"
                  onClick={goToStep3}
                  className="px-4 text-[15px] border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] text-white shadow-[0_6px_16px_rgba(31,47,116,0.28)] transition-all duration-200 hover:from-[#19265f] hover:to-[#213a80] hover:shadow-[0_10px_24px_rgba(31,47,116,0.38)]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Review & Submit</h2>
                <p className="text-sm text-gray-500">
                  Review the entry before submitting it to My Entries.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-gray-50 p-4">
                  <h3 className="mb-3 font-medium">Entry Details</h3>

                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Planning Year:</span>{" "}
                      {planningYear || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Unit:</span> {unit || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Component:</span>{" "}
                      {component || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Sub component:</span>{" "}
                      {subComponent || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Key Activity:</span>{" "}
                      {keyActivity || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">No.:</span>{" "}
                      {selectedNo || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">
                        Performance Indicator:
                      </span>{" "}
                      {selectedNoEntry?.performanceIndicator || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Sub Activity:</span>{" "}
                      {watchedSubActivity || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Title of Activities:</span>{" "}
                      {titleOfActivities || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border bg-gray-50 p-4">
                  <h3 className="mb-3 font-medium">Budget Summary</h3>

                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Unit Cost:</span>{" "}
                      {formatCurrency(toNumber(unitCost))}
                    </p>
                    <p>
                      <span className="font-medium">Active Months:</span>{" "}
                      {activeMonthlyRows.length > 0
                        ? activeMonthlyRows.map((row) => row.label).join(", ")
                        : "None"}
                    </p>
                    <p>
                      <span className="font-medium">Grand Total:</span>{" "}
                      {formatCurrency(grandTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {activeMonthlyRows.length > 0 && (
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-3 font-medium">
                    Monthly Breakdown Preview
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left">Month</th>
                          <th className="px-3 py-2 text-left">Target</th>
                          <th className="px-3 py-2 text-left">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMonthlyRows.map((row, index) => (
                          <tr
                            key={row.key}
                            className={index !== 0 ? "border-t" : ""}
                          >
                            <td className="px-3 py-2">{row.label}</td>
                            <td className="px-3 py-2">{row.target}</td>
                            <td className="px-3 py-2">
                              {formatCurrency(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="px-4 text-[15px]"
                >
                  Back
                </Button>

                <Button
                  type="submit"
                  disabled={!windowOpen}
                  className={`px-4 text-[15px] border-0 ${
                    windowOpen
                      ? "bg-gradient-to-r from-[#1f2f74] to-[#2a4694] text-white shadow-[0_6px_16px_rgba(31,47,116,0.28)] transition-all duration-200 hover:from-[#19265f] hover:to-[#213a80] hover:shadow-[0_10px_24px_rgba(31,47,116,0.38)]"
                      : "cursor-not-allowed bg-gray-300 text-gray-600"
                  }`}
                >
                  {isEditingReturnedEntry
                    ? "Resubmit Entry"
                    : "Submit to My Entries"}
                </Button>
              </div>
            </div>
          )}
          </fieldset>
        </form>
        </CardContent>
      </Card>
    </div>
  );
}

function mergeWithDefaultFormValues(values = {}) {
  return {
    ...defaultFormValues,
    ...values,
    targets: {
      ...defaultFormValues.targets,
      ...(values.targets || {}),
    },
  };
}
