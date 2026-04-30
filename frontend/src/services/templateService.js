import { supabase } from "../lib/supabase";

// READ TABLES
export const getComponents = () =>
  supabase.from("components").select("*").order("sort_order");

export const getSubComponents = () =>
  supabase.from("sub_components").select("*").order("sort_order");

export const getKeyActivities = () =>
  supabase
    .from("key_activities")
    .select("id, sub_component_id, name, code, activity_no, sort_order, is_active")
    .order("sort_order");

export const getSubActivities = () =>
  supabase
    .from("sub_activities")
    .select("id, performance_indicator_id, name, code, sort_order, is_active");

export const getUnits = () =>
  supabase.from("units").select("*").order("name");

// VIEW
export const getTemplateHierarchy = () =>
  supabase.from("template_hierarchy").select("*");

export const getPerformance_indicators = () =>
  supabase.from("performance_indicators").select("*");