import { supabase } from '../lib/supabase';

const MONTH_LABELS = {
  jan: 'Jan',
  feb: 'Feb',
  mar: 'Mar',
  apr: 'Apr',
  may: 'May',
  jun: 'Jun',
  jul: 'Jul',
  aug: 'Aug',
  sep: 'Sep',
  oct: 'Oct',
  nov: 'Nov',
  dec: 'Dec',
};

function normalizeLookupText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMonthlyTargets(monthlyTargets, unitCost) {
  if (!Array.isArray(monthlyTargets)) return [];

  return monthlyTargets
    .filter((item) => item && item.month)
    .map((item) => {
      const monthKey = String(item.month).toLowerCase();
      const target = Number(item.target_quantity || 0);
      return {
        month: MONTH_LABELS[monthKey] || monthKey,
        target,
        amount: Number(unitCost || 0) * target,
      };
    })
    .sort((a, b) => {
      const keys = Object.keys(MONTH_LABELS);
      return keys.indexOf(a.month.toLowerCase()) - keys.indexOf(b.month.toLowerCase());
    });
}

async function mapEntryRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const [
    { data: units, error: unitsError },
    { data: components, error: componentsError },
    { data: subComponents, error: subComponentsError },
    { data: keyActivities, error: keyActivitiesError },
    { data: subActivities, error: subActivitiesError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase.from('units').select('id, code, name, aliases'),
    supabase.from('components').select('id, name'),
    supabase.from('sub_components').select('id, name'),
    supabase.from('key_activities').select('*'),
    supabase.from('sub_activities').select('id, name'),
    supabase.from('profiles').select('id, username, full_name'),
  ]);

  const firstError =
    unitsError ||
    componentsError ||
    subComponentsError ||
    keyActivitiesError ||
    subActivitiesError ||
    profilesError;

  if (firstError) throw firstError;

  const unitsById = new Map((units || []).map((item) => [item.id, item]));
  const componentsById = new Map((components || []).map((item) => [item.id, item]));
  const subComponentsById = new Map((subComponents || []).map((item) => [item.id, item]));
  const keyActivitiesById = new Map((keyActivities || []).map((item) => [item.id, item]));
  const subActivitiesById = new Map((subActivities || []).map((item) => [item.id, item]));
  const profilesById = new Map((profiles || []).map((item) => [item.id, item]));

  return records.map((record) => {
    const unit = unitsById.get(record.unit_id);
    const component = componentsById.get(record.component_id);
    const subComponent = subComponentsById.get(record.sub_component_id);
    const keyActivity = keyActivitiesById.get(record.key_activity_id);
    const subActivity = record.sub_activity_id
      ? subActivitiesById.get(record.sub_activity_id)
      : null;
    const owner = profilesById.get(record.owner_id);
    const monthlyBreakdown = normalizeMonthlyTargets(record.monthly_targets, record.unit_cost);
    const grandTotal = monthlyBreakdown.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );

    return {
      id: record.id,
      ownerId: record.owner_id,
      ownerUsername: owner?.username || '',
      ownerFullName: owner?.full_name || owner?.username || '',
      planningYear: String(record.planning_year ?? ''),
      unit: unit?.code || unit?.name || '',
      component: component?.name || '',
      subComponent: subComponent?.name || '',
      keyActivity: keyActivity?.name || '',
      no: keyActivity?.activity_no || '',
      performanceIndicator: keyActivity?.performance_indicator || '',
      subActivity: subActivity?.name || 'N/A',
      titleOfActivities: record.title_of_activities,
      unitCost: Number(record.unit_cost || 0),
      monthlyBreakdown,
      grandTotal,
      status: record.status,
      adminComment: record.reviewer_notes || '',
      reviewedAt: record.review_date || '',
      submittedAt: record.submission_date || record.created_at || '',
      resubmittedAt: record.updated_at || '',
      unit_id: record.unit_id,
      component_id: record.component_id,
      sub_component_id: record.sub_component_id,
      key_activity_id: record.key_activity_id,
      sub_activity_id: record.sub_activity_id,
    };
  });
}

// Authentication services
export const authService = {
  // Sign up new user (public self-registration)
  async signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: metadata.username,
          full_name: metadata.fullName || metadata.username,
          role: metadata.role || 'encoder',
        }
      }
    });

    if (error) throw error;
    return data;
  },

  // Sign in user
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },

  // Sign out user
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current user
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Get user profile
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update user profile
  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Listen to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// User management services (admin only)
export const usersService = {
  // Get all users
  async getAll() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Create user (admin only)
  // NOTE: supabase.auth.admin.* requires the service_role key and must NEVER be called
  // from the browser. As a temporary workaround we use public signUp() and then restore
  // the admin's session so the admin doesn't get logged out.
  async create(userData) {
    // Save the current admin session so we can restore it after signUp
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    // Create the new auth user via public signUp (trigger handle_new_user creates the profile)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          username: userData.username,
          full_name: userData.fullName,
          role: userData.role
        }
      }
    });

    if (authError) throw authError;

    // Restore the admin's session (signUp auto-logs-in as the new user)
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });
    }

    return authData;
  },

  // Update user
  async update(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete user (admin only)
  async delete(userId) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
};

// Entry management services
export const entriesService = {
  // Get entries for current user or all entries for admin
  async getAll() {
    const { data: { user } } = await supabase.auth.getUser();
    
    let query = supabase
      .from('entries_with_targets')
      .select('*')
      .order('created_at', { ascending: false });

    // If not admin, only get user's entries
    const profile = await authService.getProfile(user.id);
    if (profile.role !== 'admin') {
      query = query.eq('owner_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return await mapEntryRecords(data);
  },

  // Get single entry
  async getById(id) {
    const { data, error } = await supabase
      .from('entries_with_targets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    const [mappedEntry] = await mapEntryRecords([data]);
    return mappedEntry;
  },

  // Create entry
  async create(entryData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('entries')
      .insert({
        ...entryData,
        owner_id: user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Return entry with monthly targets
    return await this.getById(data.id);
  },

  // Update entry
  async update(id, updates) {
    const { data, error } = await supabase
      .from('entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Return updated entry with monthly targets
    return await this.getById(data.id);
  },

  // Delete entry
  async delete(id) {
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Update monthly targets
  async updateMonthlyTargets(entryId, targets) {
    const updates = Object.entries(targets).map(([month, quantity]) =>
      supabase
        .from('monthly_targets')
        .upsert({
          entry_id: entryId,
          month,
          target_quantity: quantity 
        }, {
          onConflict: 'entry_id,month',
        })
    );

    const results = await Promise.all(updates);
    const failedUpdate = results.find(({ error }) => error);
    if (failedUpdate?.error) throw failedUpdate.error;
    
    return await this.getById(entryId);
  }
};

// Template services
export const templateService = {
  // Get full template hierarchy
  async getHierarchy() {
    const { data, error } = await supabase
      .from('template_hierarchy')
      .select('*');
    
    if (error) throw error;
    return data;
  },

  // Get units
  async getUnits() {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('is_active', true)
      .order('code');
    
    if (error) throw error;
    return data;
  },

  // Get components
  async getComponents() {
    const { data, error } = await supabase
      .from('components')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) throw error;
    return data;
  },

  // Get sub-components by component
  async getSubComponents(componentId) {
    const { data, error } = await supabase
      .from('sub_components')
      .select('*')
      .eq('component_id', componentId)
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) throw error;
    return data;
  },

  // Get key activities by sub-component
  async getKeyActivities(subComponentId) {
    const { data, error } = await supabase
      .from('key_activities')
      .select('*')
      .eq('sub_component_id', subComponentId)
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) throw error;
    return data;
  },

  // Get sub-activities by key activity
  async getSubActivities(keyActivityId) {
    const { data, error } = await supabase
      .from('sub_activities')
      .select('*')
      .eq('key_activity_id', keyActivityId)
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) throw error;
    return data;
  }
};

// Entry helper services
export const entryReferenceService = {
  async resolveIds({
    unit,
    component,
    subComponent,
    keyActivity,
    no,
    performanceIndicator,
    subActivity,
  }) {
    const units = await templateService.getUnits();
    const matchedUnit = units.find((item) => {
      const aliases = Array.isArray(item.aliases) ? item.aliases : [];
      return (
        normalizeLookupText(item.code) === normalizeLookupText(unit) ||
        normalizeLookupText(item.name) === normalizeLookupText(unit) ||
        aliases.some((alias) => normalizeLookupText(alias) === normalizeLookupText(unit))
      );
    });

    if (!matchedUnit) {
      throw new Error(`Unable to match unit "${unit}" to a database record.`);
    }

    const components = await templateService.getComponents();
    const matchedComponent = components.find(
      (item) => normalizeLookupText(item.name) === normalizeLookupText(component),
    );
    if (!matchedComponent) {
      throw new Error(`Unable to match component "${component}" to a database record.`);
    }

    const subComponents = await templateService.getSubComponents(matchedComponent.id);
    const matchesKeyActivity = (item) => {
      const noMatches = String(item.activity_no ?? '').trim() === String(no ?? '').trim();
      const indicatorMatches =
        normalizeLookupText(item.performance_indicator) ===
        normalizeLookupText(performanceIndicator);
      const nameMatches =
        normalizeLookupText(item.name) === normalizeLookupText(keyActivity);

      return (
        (nameMatches && noMatches) ||
        (nameMatches && indicatorMatches) ||
        (noMatches && indicatorMatches) ||
        nameMatches
      );
    };

    let matchedSubComponent =
      subComponents.find(
        (item) => normalizeLookupText(item.name) === normalizeLookupText(subComponent),
      ) || null;
    let matchedKeyActivity = null;

    if (matchedSubComponent) {
      const keyActivities = await templateService.getKeyActivities(matchedSubComponent.id);
      matchedKeyActivity = keyActivities.find(matchesKeyActivity) || null;
    }

    if (!matchedSubComponent || !matchedKeyActivity) {
      for (const candidateSubComponent of subComponents) {
        const keyActivities = await templateService.getKeyActivities(candidateSubComponent.id);
        const candidateKeyActivity = keyActivities.find(matchesKeyActivity);

        if (candidateKeyActivity) {
          matchedSubComponent = candidateSubComponent;
          matchedKeyActivity = candidateKeyActivity;
          break;
        }
      }
    }

    if (!matchedSubComponent) {
      throw new Error(
        `Unable to match sub component "${subComponent}" to a database record.`,
      );
    }

    if (!matchedKeyActivity) {
      throw new Error(`Unable to match key activity "${keyActivity}" to a database record.`);
    }

    let matchedSubActivity = null;
    if (subActivity && subActivity !== 'N/A') {
      const subActivities = await templateService.getSubActivities(matchedKeyActivity.id);
      matchedSubActivity =
        subActivities.find(
          (item) => normalizeLookupText(item.name) === normalizeLookupText(subActivity),
        ) || null;

      if (!matchedSubActivity) {
        throw new Error(`Unable to match sub activity "${subActivity}" to a database record.`);
      }
    }

    return {
      unitId: matchedUnit.id,
      componentId: matchedComponent.id,
      subComponentId: matchedSubComponent.id,
      keyActivityId: matchedKeyActivity.id,
      subActivityId: matchedSubActivity?.id || null,
    };
  },
};

// Template management services (admin only)
export const templateManagementService = {
  // Component management
  async createComponent(componentData) {
    const { data, error } = await supabase
      .from('components')
      .insert(componentData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateComponent(id, updates) {
    const { data, error } = await supabase
      .from('components')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteComponent(id) {
    const { error } = await supabase
      .from('components')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Similar methods for sub-components, key activities, and sub-activities...
  async createSubComponent(subComponentData) {
    const { data, error } = await supabase
      .from('sub_components')
      .insert(subComponentData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async createKeyActivity(keyActivityData) {
    const { data, error } = await supabase
      .from('key_activities')
      .insert(keyActivityData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async createSubActivity(subActivityData) {
    const { data, error } = await supabase
      .from('sub_activities')
      .insert(subActivityData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Submission window services
export const submissionService = {
  // Get active submission window
  async getActiveWindow() {
    const { data, error } = await supabase
      .from('submission_windows')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Real-time subscriptions
export const realtimeService = {
  // Subscribe to entries changes
  subscribeToEntries(callback) {
    return supabase
      .channel('entries_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'entries' },
        callback
      )
      .subscribe();
  },

  // Subscribe to user profile changes
  subscribeToProfiles(callback) {
    return supabase
      .channel('profiles_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        callback
      )
      .subscribe();
  }
};
