import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import AdminDeleteTemplateItemModal from "@/components/admin/AdminDeleteTemplateItemModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  createComponent,
  updateComponent,
  deleteComponentDB,

  createSubComponent,
  updateSubComponent,
  deleteSubComponentDB,

  createKeyActivity,
  updateKeyActivity,
  deleteKeyActivityDB,

  createPerformanceIndicator,
  updatePerformanceIndicator,
  deletePerformanceIndicator,

  createSubActivity,
  updateSubActivity,
  deleteSubActivityDB,
} from "@/services/templateManagementService";

import {
  getComponents,
  getSubComponents,
  getKeyActivities,
  getUnits,
  getSubActivities,
  getPerformance_indicators,
} from "@/services/templateService";

function cloneTemplateData(templateData) {
  return JSON.parse(JSON.stringify(templateData));
}

function normalizeName(value) {
  return String(value || "").trim();
}

function normalizeIndicatorNo(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? trimmed : numeric;
}

const panelClass =
  "min-w-0 rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.07)]";
const emptyStateClass =
  "rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500";
const inputClass =
  "h-11 rounded-xl border-slate-200 bg-slate-50 px-4 text-sm shadow-none focus-visible:ring-slate-200";
const primaryButtonClass =
  "h-11 rounded-xl border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] px-4 text-white shadow-[0_8px_20px_rgba(31,47,116,0.18)] hover:from-[#19265f] hover:to-[#213a80]";
const secondaryButtonClass =
  "h-11 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
const dangerButtonClass =
  "h-11 rounded-xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
const dropdownTriggerClass =
  "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400";
const actionIconButtonClass =
  "rounded-lg p-2 transition";
const editActionIconButtonClass =
  `${actionIconButtonClass} text-sky-500 hover:bg-sky-50 hover:text-sky-700`;
const deleteActionIconButtonClass =
  `${actionIconButtonClass} text-red-400 hover:bg-red-50 hover:text-red-600`;
const saveInlineButtonClass =
  "rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100";
const addPickerButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-200 bg-sky-50/60 px-4 py-2.5 text-sm text-sky-700 transition hover:border-sky-300 hover:bg-sky-50";

function getSelectableClass(selected) {
  return `w-full rounded-[1.15rem] border px-4 py-3 text-left text-sm transition ${
    selected
      ? "border-[#1f2f74]/25 bg-[#eef2ff] text-slate-900 shadow-[0_6px_18px_rgba(31,47,116,0.08)]"
      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
  }`;
}

function getLockedPanelClass(enabled) {
  return enabled
    ? panelClass
    : `${panelClass} border-slate-200 bg-slate-50/80 opacity-75`;
}

function getPanelTitleClass(enabled) {
  return enabled ? "text-lg text-slate-900" : "text-lg text-slate-400";
}

function getPanelDescriptionClass(enabled) {
  return enabled ? "text-sm text-slate-500" : "text-sm text-slate-400";
}

function getEmptyStateClass(enabled) {
  return enabled
    ? emptyStateClass
    : "rounded-[1.25rem] border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-400";
}

function getTemplateLabel(value, emptyLabel) {
  return normalizeName(value) || emptyLabel;
}

export default function ManageTemplate({
  templateData,
  onUpdateTemplateData,
  onResetTemplate,
  onShowToast,
}) {
  const hierarchy = templateData?.hierarchy || {};

  const [selectedComponent, setSelectedComponent] = useState("");

  const [components, setComponents] = useState([]);
  const [subComponents, setSubComponents] = useState([]);
  const [keyActivities, setKeyActivities] = useState([]);
  const [units, setUnits] = useState([]);
  const [subActivities, setSubActivities] = useState([]);
  const [performance_indicators, setPerformance_indicators] = useState([]);

  const [selectedSubComponent, setSelectedSubComponent] = useState("");
  const [selectedKeyActivity, setSelectedKeyActivity] = useState("");
  const [selectedIndicatorIndex, setSelectedIndicatorIndex] = useState(0);
  const [selectedSubActivityIndex, setSelectedSubActivityIndex] = useState(0);
  const [componentMenuOpen, setComponentMenuOpen] = useState(false);
  const [showAddComponentInput, setShowAddComponentInput] = useState(false);
  const [editingComponentName, setEditingComponentName] = useState("");
  const [subComponentMenuOpen, setSubComponentMenuOpen] = useState(false);
  const [showAddSubComponentInput, setShowAddSubComponentInput] = useState(false);
  const [editingSubComponentName, setEditingSubComponentName] = useState("");
  const [keyActivityMenuOpen, setKeyActivityMenuOpen] = useState(false);
  const [showAddKeyActivityInput, setShowAddKeyActivityInput] = useState(false);
  const [editingKeyActivityName, setEditingKeyActivityName] = useState("");
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const [showAddIndicatorInput, setShowAddIndicatorInput] = useState(false);
  const [editingIndicatorIndex, setEditingIndicatorIndex] = useState(null);
  const [subActivityMenuOpen, setSubActivityMenuOpen] = useState(false);
  const [showAddSubActivityInput, setShowAddSubActivityInput] = useState(false);
  const [editingSubActivityIndex, setEditingSubActivityIndex] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [newComponentName, setNewComponentName] = useState("");
  const [newSubComponentName, setNewSubComponentName] = useState("");
  const [newKeyActivityName, setNewKeyActivityName] = useState("");
  const [newIndicatorNo, setNewIndicatorNo] = useState("");
  const [newIndicatorText, setNewIndicatorText] = useState("");
  const [newSubActivityText, setNewSubActivityText] = useState("");

  const [componentDraft, setComponentDraft] = useState("");
  const [subComponentDraft, setSubComponentDraft] = useState("");
  const [keyActivityDraft, setKeyActivityDraft] = useState("");
  const [indicatorDraft, setIndicatorDraft] = useState({
    no: "",
    performanceIndicator: "",
  });
  const [subActivityDraft, setSubActivityDraft] = useState("");

   const componentNames = useMemo(() => {
  return Array.isArray(components)
    ? [...components]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => item.name)
    : [];
}, [components]);

  const subComponentNames = useMemo(() => {
  const selected = components.find(
    (item) => item.name === selectedComponent
  );

  if (!selected) return [];

  return subComponents
    .filter((item) => item.component_id === selected.id)
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    )
    .map((item) => item.name);
}, [selectedComponent, components, subComponents]);

  const keyActivityNames = useMemo(() => {
  const selectedComp = components.find(
    (item) => item.name === selectedComponent
  );

  if (!selectedComp) return [];

  const selectedSub = subComponents.find(
    (item) =>
      item.name === selectedSubComponent &&
      item.component_id === selectedComp.id
  );

  if (!selectedSub) return [];

  return keyActivities
    .filter((item) => item.sub_component_id === selectedSub.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => item.name);
}, [
  selectedComponent,
  selectedSubComponent,
  components,
  subComponents,
  keyActivities,
]);

  const indicatorItems = useMemo(() => {
  const selectedKA = keyActivities.find(
    (item) => item.name === selectedKeyActivity
  );

  if (!selectedKA) return [];

  return performance_indicators
    .filter((item) => item.key_activity_id === selectedKA.id)
    .sort((a, b) => Number(a.activity_no) - Number(b.activity_no))
    .map((item) => ({
      label: item.activity_no,
      value: item.id,
      performance_indicators: item.label,
    }));
}, [
  selectedKeyActivity,
  keyActivities,
  performance_indicators,
]);

  
  const selectedIndicator = indicatorItems[selectedIndicatorIndex] || indicatorItems[0] || null;

const subActivityItems = useMemo(() => {
  if (!selectedIndicator) return [];

  return subActivities
    .filter(
      (item) =>
        item.performance_indicator_id === selectedIndicator.value
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => item.name);
}, [selectedIndicator, subActivities]);

const selectedSubActivity = subActivityItems[selectedSubActivityIndex] || "";

const hasComponentSelected =
  componentNames.includes(selectedComponent);

const hasSubComponentSelected =
  subComponentNames.includes(selectedSubComponent);

const hasKeyActivitySelected =
  keyActivityNames.includes(selectedKeyActivity);

const hasIndicatorSelected =
  Boolean(selectedIndicator);

  const loadData = async () => {
  const { data: c } = await getComponents();
  const { data: s } = await getSubComponents();
  const { data: k } = await getKeyActivities();
  const { data: u } = await getUnits();
  const { data: pi } = await getPerformance_indicators();
  const { data: sa } = await getSubActivities();

  setComponents(c || []);
  setSubComponents(s || []);
  setKeyActivities(k || []);
  setUnits(u || []);
  setPerformance_indicators(pi || []);
  setSubActivities(sa || []);
};

useEffect(() => {
  loadData();
}, []);

  useEffect(() => {
    if (componentNames.length === 0) {
      setSelectedComponent("");
      return;
    }

    if (!componentNames.includes(selectedComponent)) {
      setSelectedComponent(componentNames[0]);
    }
  }, [componentNames, selectedComponent]);

  useEffect(() => {
    if (subComponentNames.length === 0) {
      setSelectedSubComponent("");
      return;
    }

    if (!subComponentNames.includes(selectedSubComponent)) {
      setSelectedSubComponent(subComponentNames[0]);
    }
  }, [selectedSubComponent, subComponentNames]);

  useEffect(() => {
    if (keyActivityNames.length === 0) {
      setSelectedKeyActivity("");
      return;
    }

    if (!keyActivityNames.includes(selectedKeyActivity)) {
      setSelectedKeyActivity(keyActivityNames[0]);
    }
  }, [keyActivityNames, selectedKeyActivity]);

  useEffect(() => {
    if (indicatorItems.length === 0) {
      setSelectedIndicatorIndex(0);
      return;
    }

    if (selectedIndicatorIndex > indicatorItems.length - 1) {
      setSelectedIndicatorIndex(0);
    }
  }, [indicatorItems, selectedIndicatorIndex]);

  useEffect(() => {
    if (subActivityItems.length === 0) {
      setSelectedSubActivityIndex(0);
      return;
    }

    if (selectedSubActivityIndex > subActivityItems.length - 1) {
      setSelectedSubActivityIndex(0);
    }
  }, [selectedSubActivityIndex, subActivityItems]);

  useEffect(() => {
    setComponentDraft(selectedComponent);
  }, [selectedComponent]);

  useEffect(() => {
    setSubComponentDraft(selectedSubComponent);
  }, [selectedSubComponent]);

  useEffect(() => {
    setKeyActivityDraft(selectedKeyActivity);
  }, [selectedKeyActivity]);

  useEffect(() => {
    if (!selectedIndicator) {
      setIndicatorDraft({
        no: "",
        performanceIndicator: "",
      });
      return;
    }

    setIndicatorDraft({
      no: String(selectedIndicator.label ?? ""),
performanceIndicator: selectedIndicator.performanceIndicator || ""
    });
  }, [selectedIndicator]);

  useEffect(() => {
    setSubActivityDraft(selectedSubActivity);
  }, [selectedSubActivity]);

  const updateTemplate = (updater) => {
    const nextTemplate = cloneTemplateData(templateData);
    updater(nextTemplate);
    onUpdateTemplateData?.(nextTemplate);
  };

  const addComponent = async () => {
  const name = normalizeName(newComponentName);

  if (!name) return;

  const { error } = await createComponent(name);

  if (error) {
    onShowToast?.({
      title: "Error",
      description: error.message,
      type: "error",
    });
    return;
  }

  onShowToast?.({
    title: "Component added",
    description: `${name} saved to Supabase.`,
    type: "success",
  });

  setNewComponentName("");
  setComponentMenuOpen(false);
  setShowAddComponentInput(false);

  await loadData();
setSelectedComponent(name);
};

  const renameComponent = async () => {
  const nextName = normalizeName(componentDraft);
  if (!selectedComponent || !nextName) return;

  const selected = components.find(
    (item) => item.name === selectedComponent
  );
  if (!selected) return;

  const { error } = await updateComponent(selected.id, nextName);

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setSelectedComponent(nextName);
  setEditingComponentName("");
};

  const deleteComponent = async () => {
  if (!deleteTarget || deleteTarget.kind !== "component") return;

  const { error } = await deleteComponentDB(deleteTarget.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setDeleteTarget(null);
};

  const addSubComponent = async () => {
  const name = normalizeName(newSubComponentName);

  if (!selectedComponent || !name) return;

  const selected = components.find(
    (item) => item.name === selectedComponent
  );

  if (!selected) {
    onShowToast?.({
      title: "Error",
      description: "Please select a component first.",
      type: "error",
    });
    return;
  }

  const { error } = await createSubComponent(selected.id, name);

  if (error) {
  console.log("SUB COMPONENT ERROR:", error);
  alert(error.message);
  return;
}

  onShowToast?.({
    title: "Sub Component added",
    description: `${name} saved to Supabase.`,
    type: "success",
  });

  setNewSubComponentName("");
  setSubComponentMenuOpen(false);
  setShowAddSubComponentInput(false);

  await loadData();
  setSelectedSubComponent(name);
};

  const renameSubComponent = async () => {
  const nextName = normalizeName(subComponentDraft);
  if (!selectedSubComponent || !nextName) return;

  const selected = subComponents.find(
    (item) => item.name === selectedSubComponent
  );

  if (!selected) return;

  const { error } = await updateSubComponent(selected.id, nextName);

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setSelectedSubComponent(nextName);
};

  const deleteSubComponent = async () => {
  if (!deleteTarget || deleteTarget.kind !== "subComponent") return;

  const selected = subComponents.find(
    (item) => item.name === deleteTarget.label
  );

  if (!selected) return;

  const { error } = await deleteSubComponentDB(selected.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setDeleteTarget(null);
};

  const addKeyActivity = async () => {
  const name = normalizeName(newKeyActivityName);

  if (!selectedSubComponent || !name) return;

  const selectedComp = components.find(
    (item) => item.name === selectedComponent
  );

  if (!selectedComp) return;

  const selectedSub = subComponents.find(
    (item) =>
      item.name === selectedSubComponent &&
      item.component_id === selectedComp.id
  );

  if (!selectedSub) return;

  const { error } = await createKeyActivity(selectedSub.id, name);

  if (error) {
    onShowToast?.({
      title: "Error",
      description: error.message,
      type: "error",
    });
    return;
  }

  await loadData();

  setSelectedKeyActivity(name);
  setNewKeyActivityName("");
  setShowAddKeyActivityInput(false);
  setKeyActivityMenuOpen(false);

  onShowToast?.({
    title: "Key Activity Added",
    description: "Saved to Supabase successfully.",
    type: "success",
  });
};

  const renameKeyActivity = async () => {
  const nextName = normalizeName(keyActivityDraft);
  if (!selectedKeyActivity || !nextName) return;

  const selected = keyActivities.find(
    (item) => item.name === selectedKeyActivity
  );

  if (!selected) return;

  const { error } = await updateKeyActivity(selected.id, {
    name: nextName,
  });

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setSelectedKeyActivity(nextName);
};

  const deleteKeyActivity = async () => {
  if (
    !deleteTarget ||
    deleteTarget.kind !== "keyActivity"
  ) return;

  const selectedItem = keyActivities.find(
    (item) => item.name === deleteTarget.label
  );

  if (!selectedItem) return;

  const { error } = await deleteKeyActivityDB(selectedItem.id);

  if (error) {
    onShowToast?.({
      title: "Error",
      description: error.message,
      type: "error",
    });
    return;
  }

  await loadData();

  setDeleteTarget(null);
  setEditingKeyActivityName("");

  onShowToast?.({
    title: "Deleted",
    description: "Key Activity removed successfully.",
    type: "success",
  });
};

const addIndicator = async () => {
  const no = normalizeName(newIndicatorNo);
  const text = normalizeName(newIndicatorText);

  if (!selectedKeyActivity || !no || !text) return;

  const selectedKA = keyActivities.find(
    (item) => item.name === selectedKeyActivity
  );

  if (!selectedKA) return;

  const { error } = await createPerformanceIndicator(
    selectedKA.id,
    no,
    text
  );

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setSelectedIndicatorIndex(indicatorItems.length);

  setNewIndicatorNo("");
  setNewIndicatorText("");
  setShowAddIndicatorInput(false);
};

  const saveIndicator = async () => {
  if (!selectedIndicator) return;

  const { error } = await updatePerformanceIndicator(
    selectedIndicator.value,
    indicatorDraft.no,
    indicatorDraft.performanceIndicator
  );

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setEditingIndicatorIndex(null);
};

 const deleteIndicator = async () => {
  if (!deleteTarget || deleteTarget.kind !== "indicator") return;

  const current = indicatorItems[deleteTarget.index];
  if (!current) return;

  const { error } = await deletePerformanceIndicator(current.value);

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setDeleteTarget(null);
};

const addSubActivity = async () => {
  const text = normalizeName(newSubActivityText);

  if (!selectedIndicator || !text) return;

  const { error } = await createSubActivity(
    selectedIndicator.value,
    text
  );

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();
  setSelectedSubActivityIndex(subActivityItems.length);

  setNewSubActivityText("");
  setShowAddSubActivityInput(false);
};

const saveSubActivity = async () => {
  const nextText = normalizeName(subActivityDraft);

  if (
    editingSubActivityIndex === null ||
    !selectedIndicator ||
    !nextText
  ) return;

  const currentItem = subActivities.filter(
    (item) =>
      item.performance_indicator_id === selectedIndicator.value
  )[editingSubActivityIndex];

  if (!currentItem) return;

  const { error } = await updateSubActivity(currentItem.id, nextText);

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();

  setEditingSubActivityIndex(null);

  onShowToast?.({
    title: "Updated",
    description: "Sub Activity updated successfully.",
    type: "success",
  });
};

const deleteSubActivity = async () => {
  if (
    !deleteTarget ||
    deleteTarget.kind !== "subActivity" ||
    !selectedIndicator
  ) return;

  const currentItem = subActivities.filter(
    (item) =>
      item.performance_indicator_id === selectedIndicator.value
  )[deleteTarget.index];

  if (!currentItem) return;

  const { error } = await deleteSubActivityDB(currentItem.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadData();

  setDeleteTarget(null);
  setEditingSubActivityIndex(null);
  setSelectedSubActivityIndex(0);

  onShowToast?.({
    title: "Deleted",
    description: "Sub Activity removed successfully.",
    type: "success",
  });
};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Manage Template
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Update the classification hierarchy used by the Submit Entry form.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className={secondaryButtonClass}
            onClick={() => {
              onResetTemplate?.();
              onShowToast?.({
                title: "Template reset",
                description: "The template was restored to its default frontend state.",
                type: "success",
              });
            }}
          >
            Reset to Default
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className={panelClass}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-slate-900">Component</CardTitle>
            <p className={getPanelDescriptionClass(hasSubComponentSelected)}>
              Select and manage the main component used in this template.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => setComponentMenuOpen((prev) => !prev)}
              className={dropdownTriggerClass}
            >
              <span className="truncate">{selectedComponent || "Select component"}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${componentMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {componentMenuOpen && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {componentNames.map((name) => (
                    <div
                      key={name}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                        selectedComponent === name
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {editingComponentName === name ? (
                        <div className="min-w-0 flex-1">
                          <Input
                            value={componentDraft}
                            onChange={(event) => setComponentDraft(event.target.value)}
                            className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedComponent(name);
                            setEditingComponentName("");
                          }}
                          className="min-w-0 flex-1 text-left text-sm text-slate-700"
                        >
                          <span className="block truncate">{name}</span>
                        </button>
                      )}
                      {selectedComponent === name && (
                        <>
                          {editingComponentName === name ? (
                            <>
                              <button
                                type="button"
                                onClick={renameComponent}
                                className={saveInlineButtonClass}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingComponentName("");
                                  setComponentDraft(selectedComponent);
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Cancel rename"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setComponentDraft(name);
                                  setEditingComponentName(name);
                                  setShowAddComponentInput(false);
                                }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename component"
                                >
                                  <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                               onClick={() => {
                               const selected = components.find((item) => item.name === name);

                               setDeleteTarget({
                               kind: "component",
                               id: selected?.id,
                               label: name,
                                  });
                            }}
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete component"
                                >
                                  <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddComponentInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddComponentInput(true);
                        setEditingComponentName("");
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Component
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newComponentName}
                        onChange={(event) => setNewComponentName(event.target.value)}
                        placeholder="New component"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={addComponent}
                          className={`flex-1 ${primaryButtonClass}`}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddComponentInput(false);
                            setNewComponentName("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={getLockedPanelClass(hasComponentSelected)}>
          <CardHeader className="pb-3">
            <CardTitle className={getPanelTitleClass(hasComponentSelected)}>
              Sub Component
            </CardTitle>
            <p className={getPanelDescriptionClass(hasComponentSelected)}>
              Select and manage the sub component under the chosen component.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => hasComponentSelected && setSubComponentMenuOpen((prev) => !prev)}
              disabled={!hasComponentSelected}
              className={dropdownTriggerClass}
            >
              <span className="truncate">
                {hasSubComponentSelected
                  ? getTemplateLabel(selectedSubComponent, "No sub component")
                  : "Select sub component"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${subComponentMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {subComponentMenuOpen && hasComponentSelected && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {subComponentNames.length === 0 ? (
                    <div className={getEmptyStateClass(hasComponentSelected)}>
                      Select a component to manage its sub components.
                    </div>
                  ) : (
                    subComponentNames.map((name) => (
                      <div
                        key={name}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                          selectedSubComponent === name
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {editingSubComponentName === name ? (
                          <div className="min-w-0 flex-1">
                            <Input
                              value={subComponentDraft}
                              onChange={(event) => setSubComponentDraft(event.target.value)}
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubComponent(name);
                              setEditingSubComponentName("");
                            }}
                            className="min-w-0 flex-1 text-left text-sm text-slate-700"
                          >
                            <span className="block truncate">
                              {getTemplateLabel(name, "No sub component")}
                            </span>
                          </button>
                        )}
                        {selectedSubComponent === name && (
                          <>
                            {editingSubComponentName === name ? (
                              <>
                                <button
                                  type="button"
                                  onClick={renameSubComponent}
                                  className={saveInlineButtonClass}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSubComponentName("");
                                    setSubComponentDraft(selectedSubComponent);
                                  }}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Cancel rename"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSubComponentDraft(name);
                                    setEditingSubComponentName(name);
                                    setShowAddSubComponentInput(false);
                                  }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename sub component"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: "subComponent",
                                      label: getTemplateLabel(name, "No sub component"),
                                    })
                                  }
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete sub component"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddSubComponentInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSubComponentInput(true);
                        setEditingSubComponentName("");
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Sub Component
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newSubComponentName}
                        onChange={(event) => setNewSubComponentName(event.target.value)}
                        placeholder="New sub component"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={addSubComponent} className={`flex-1 ${primaryButtonClass}`}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddSubComponentInput(false);
                            setNewSubComponentName("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AdminDeleteTemplateItemModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemType={
          deleteTarget?.kind === "component"
            ? "Component"
            : deleteTarget?.kind === "subComponent"
              ? "Sub Component"
              : deleteTarget?.kind === "keyActivity"
                ? "Key Activity"
                : deleteTarget?.kind === "indicator"
                  ? "Performance Indicator"
                  : deleteTarget?.kind === "subActivity"
                    ? "Sub Activity"
                    : "Template Item"
        }
        itemLabel={deleteTarget?.label || ""}
        onConfirm={() => {
          if (deleteTarget?.kind === "component") deleteComponent();
          if (deleteTarget?.kind === "subComponent") deleteSubComponent();
          if (deleteTarget?.kind === "keyActivity") deleteKeyActivity();
          if (deleteTarget?.kind === "indicator") deleteIndicator();
          if (deleteTarget?.kind === "subActivity") deleteSubActivity();
        }}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className={getLockedPanelClass(hasSubComponentSelected)}>
          <CardHeader className="pb-3">
            <CardTitle className={getPanelTitleClass(hasSubComponentSelected)}>
              Key Activity
            </CardTitle>
            <p className={getPanelDescriptionClass(hasSubComponentSelected)}>
              Select and manage the key activity under the chosen sub component.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => hasSubComponentSelected && setKeyActivityMenuOpen((prev) => !prev)}
              disabled={!hasSubComponentSelected}
              className={dropdownTriggerClass}
            >
              <span className="truncate">
                {hasKeyActivitySelected ? selectedKeyActivity : "Select key activity"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${keyActivityMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {keyActivityMenuOpen && hasSubComponentSelected && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {keyActivityNames.length === 0 ? (
                    <div className={getEmptyStateClass(hasSubComponentSelected)}>
                      Select a sub component to manage key activities.
                    </div>
                  ) : (
                    keyActivityNames.map((name) => (
                      <div
                        key={name}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                          selectedKeyActivity === name
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {editingKeyActivityName === name ? (
                          <div className="min-w-0 flex-1">
                            <Input
                              value={keyActivityDraft}
                              onChange={(event) => setKeyActivityDraft(event.target.value)}
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedKeyActivity(name);
                              setEditingKeyActivityName("");
                            }}
                            className="min-w-0 flex-1 text-left text-sm text-slate-700"
                          >
                            <span className="block truncate">{name}</span>
                          </button>
                        )}
                        {selectedKeyActivity === name && (
                          <>
                            {editingKeyActivityName === name ? (
                              <>
                                <button
                                  type="button"
                                  onClick={renameKeyActivity}
                                  className={saveInlineButtonClass}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKeyActivityName("");
                                    setKeyActivityDraft(selectedKeyActivity);
                                  }}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Cancel rename"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setKeyActivityDraft(name);
                                    setEditingKeyActivityName(name);
                                    setShowAddKeyActivityInput(false);
                                  }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename key activity"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: "keyActivity",
                                      label: name,
                                    })
                                  }
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete key activity"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddKeyActivityInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddKeyActivityInput(true);
                        setEditingKeyActivityName("");
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Key Activity
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newKeyActivityName}
                        onChange={(event) => setNewKeyActivityName(event.target.value)}
                        placeholder="New key activity"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={addKeyActivity} className={`flex-1 ${primaryButtonClass}`}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddKeyActivityInput(false);
                            setNewKeyActivityName("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className={getLockedPanelClass(hasKeyActivitySelected)}>
          <CardHeader className="pb-3">
            <CardTitle className={getPanelTitleClass(hasKeyActivitySelected)}>
              Performance Indicator
            </CardTitle>
            <p className={getPanelDescriptionClass(hasKeyActivitySelected)}>
              Select and manage the performance indicator under the chose key activity.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => hasKeyActivitySelected && setIndicatorMenuOpen((prev) => !prev)}
              disabled={!hasKeyActivitySelected}
              className={dropdownTriggerClass}
            >
              <span className="truncate">
                {selectedIndicator ? `No. ${selectedIndicator.label}` : "Select performance indicator"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${indicatorMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {indicatorMenuOpen && hasKeyActivitySelected && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {indicatorItems.length === 0 ? (
                    <div className={getEmptyStateClass(hasKeyActivitySelected)}>
                      Select a key activity to manage its performance indicators.
                    </div>
                  ) : (
                    indicatorItems.map((item, index) => (
                      <div
                        key={`${item.value}-${index}`}
                        className={`flex items-start gap-2 rounded-xl border px-3 py-2 transition ${
                          selectedIndicatorIndex === index
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {editingIndicatorIndex === index ? (
                          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[110px_1fr]">
                            <Input
                              value={indicatorDraft.no}
                              onChange={(event) =>
                                setIndicatorDraft((prev) => ({
                                  ...prev,
                                  no: event.target.value,
                                }))
                              }
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                              autoFocus
                            />
                            <Input
                              value={indicatorDraft.performanceIndicator}
                              onChange={(event) =>
                                setIndicatorDraft((prev) => ({
                                  ...prev,
                                  performanceIndicator: event.target.value,
                                }))
                              }
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIndicatorIndex(index);
                              setEditingIndicatorIndex(null);
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="text-sm font-medium text-slate-800">No. {item.label}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {item.performance_indicators}
                            </p>
                          </button>
                        )}

                        {selectedIndicatorIndex === index && (
                          <>
                            {editingIndicatorIndex === index ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    saveIndicator();
                                    setEditingIndicatorIndex(null);
                                  }}
                                  className={saveInlineButtonClass}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingIndicatorIndex(null);
                                    setIndicatorDraft({
                                    no: String(item.label ?? ""),
                                    performanceIndicator: item.performance_indicators || "",
                                    });
                                  }}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Cancel rename"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedIndicatorIndex(index);
                                    setIndicatorDraft({
                                    no: String(item.label ?? ""),
                                    performanceIndicator: item.performance_indicators || "",
                                    });
                                    setEditingIndicatorIndex(index);
                                    setShowAddIndicatorInput(false);
                                  }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename performance indicator"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: "indicator",
                                      label: String(item.label),
                                      index,
                                    })
                                  }
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete performance indicator"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddIndicatorInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddIndicatorInput(true);
                        setEditingIndicatorIndex(null);
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Performance Indicator
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr]">
                        <Input
                          value={newIndicatorNo}
                          onChange={(event) => setNewIndicatorNo(event.target.value)}
                          placeholder="No."
                          className={inputClass}
                        />
                        <Input
                          value={newIndicatorText}
                          onChange={(event) => setNewIndicatorText(event.target.value)}
                          placeholder="New performance indicator"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" onClick={addIndicator} className={`flex-1 ${primaryButtonClass}`}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddIndicatorInput(false);
                            setNewIndicatorNo("");
                            setNewIndicatorText("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      <div className="flex justify-center">
        <Card
          className={`${getLockedPanelClass(hasIndicatorSelected)} w-full md:max-w-[calc(50%-0.75rem)]`}
        >
          <CardHeader className="pb-3">
            <CardTitle className={getPanelTitleClass(hasIndicatorSelected)}>
              Sub Activities
            </CardTitle>
            <p className={getPanelDescriptionClass(hasIndicatorSelected)}>
              Select and manage the sub activities under the chosen performance indicator.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => hasIndicatorSelected && setSubActivityMenuOpen((prev) => !prev)}
              disabled={!hasIndicatorSelected}
              className={dropdownTriggerClass}
            >
              <span className="truncate">
                {selectedSubActivity || "Select sub activity"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition ${subActivityMenuOpen ? "rotate-180 text-[#2a4694]" : "text-slate-400"}`}
              />
            </button>

            {subActivityMenuOpen && hasIndicatorSelected && (
              <div className="rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {subActivityItems.length === 0 ? (
                    <div className={emptyStateClass}>
                      No sub activities yet for the selected performance indicator.
                    </div>
                  ) : (
                    subActivityItems.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                          selectedSubActivityIndex === index
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {editingSubActivityIndex === index ? (
                          <div className="min-w-0 flex-1">
                            <Input
                              value={subActivityDraft}
                              onChange={(event) => setSubActivityDraft(event.target.value)}
                              className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubActivityIndex(index);
                              setEditingSubActivityIndex(null);
                            }}
                            className="min-w-0 flex-1 text-left text-sm text-slate-700"
                          >
                            <span className="block truncate">{item}</span>
                          </button>
                        )}
                        {selectedSubActivityIndex === index && (
                          <>
                            {editingSubActivityIndex === index ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    saveSubActivity();
                                    setEditingSubActivityIndex(null);
                                  }}
                                  className={saveInlineButtonClass}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSubActivityIndex(null);
                                    setSubActivityDraft(selectedSubActivity);
                                  }}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Cancel rename"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSubActivityIndex(index);
                                    setSubActivityDraft(item);
                                    setEditingSubActivityIndex(index);
                                    setShowAddSubActivityInput(false);
                                  }}
                                  className={editActionIconButtonClass}
                                  aria-label="Rename sub activity"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: "subActivity",
                                      label: item,
                                      index,
                                    })
                                  }
                                  className={deleteActionIconButtonClass}
                                  aria-label="Delete sub activity"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2">
                  {!showAddSubActivityInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSubActivityInput(true);
                        setEditingSubActivityIndex(null);
                      }}
                      className={addPickerButtonClass}
                    >
                      <Plus size={15} className="text-sky-600" />
                      Add Sub Activity
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newSubActivityText}
                        onChange={(event) => setNewSubActivityText(event.target.value)}
                        placeholder="New sub activity"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={addSubActivity} className={`flex-1 ${primaryButtonClass}`}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddSubActivityInput(false);
                            setNewSubActivityText("");
                          }}
                          className={`flex-1 ${secondaryButtonClass}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
