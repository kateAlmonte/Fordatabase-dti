import { supabase } from "../lib/supabase";

// helper: get next sort order
const getNextSortOrder = async (table) => {
  const { data, error } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) throw error;

  return data && data.length > 0
    ? Number(data[0].sort_order || 0) + 1
    : 1;
};

// COMPONENTS
export const createComponent = async (name) => {
  const nextSort = await getNextSortOrder("components");

  return await supabase.from("components").insert([
    {
      name,
      code: name.toUpperCase().replaceAll(" ", "_"),
      sort_order: nextSort,
      is_active: true,
    },
  ]);
};

export const updateComponent = (id, name) =>
  supabase.from("components").update({ name }).eq("id", id);

export const deleteComponentDB = (id) =>
  supabase.from("components").delete().eq("id", id);

// SUB COMPONENTS
export const createSubComponent = async (component_id, name) => {
  const nextSort = await getNextSortOrder("sub_components");

  return await supabase.from("sub_components").insert([
    {
      component_id,
      name,
      code: `${component_id}_${name.toUpperCase().replaceAll(" ", "_")}`,
      sort_order: nextSort,
      is_active: true,
    },
  ]);
};

export const updateSubComponent = (id, name) =>
  supabase.from("sub_components").update({ name }).eq("id", id);

export const deleteSubComponentDB = (id) =>
  supabase.from("sub_components").delete().eq("id", id);

// KEY ACTIVITIES
export const createKeyActivity = async (
  sub_component_id,
  name,
  activity_no = ""
) => {
  const nextSort = await getNextSortOrder("key_activities");

  return await supabase.from("key_activities").insert([
    {
      sub_component_id,
      name,
      code: `${sub_component_id}_${name.toUpperCase().replaceAll(" ", "_")}_${activity_no}`,
      activity_no,
      sort_order: nextSort,
      is_active: true,
    },
  ]);
};

export const updateKeyActivity = (id, values) =>
  supabase.from("key_activities").update(values).eq("id", id);

export const deleteKeyActivityDB = (id) =>
  supabase.from("key_activities").delete().eq("id", id);

// SUB ACTIVITIES
export const createSubActivity = async (performanceIndicatorId, name) => {
  const nextSort = await getNextSortOrder("sub_activities");

  return await supabase.from("sub_activities").insert([
    {
      performance_indicator_id: performanceIndicatorId,
      name,
      code: `${performanceIndicatorId}_${name.toUpperCase().replaceAll(" ", "_")}`,
      sort_order: nextSort,
      is_active: true,
    },
  ]);
};

export const updateSubActivity = async (id, name) => {
  return await supabase
    .from("sub_activities")
    .update({
      name,
      code: name.toUpperCase().replaceAll(" ", "_"),
    })
    .eq("id", id);
};

export const deleteSubActivityDB = async (id) => {
  return await supabase
    .from("sub_activities")
    .delete()
    .eq("id", id);
};

// PERFORMANCE INDICATORS
export const createPerformanceIndicator = async (
  key_activity_id,
  activity_no,
  label
) => {
  const nextSort = await getNextSortOrder("performance_indicators");

  return await supabase.from("performance_indicators").insert([
    {
      key_activity_id,
      activity_no,
      label,
      sort_order: nextSort,
      is_active: true,
    },
  ]);
};

export const updatePerformanceIndicator = (id, activity_no, label) =>
  supabase
    .from("performance_indicators")
    .update({
      activity_no,
      label,
    })
    .eq("id", id);

export const deletePerformanceIndicator = (id) =>
  supabase
    .from("performance_indicators")
    .delete()
    .eq("id", id);