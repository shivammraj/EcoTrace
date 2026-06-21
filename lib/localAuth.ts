/**
 * IMPORTANT NOTE:
 * This is local-only, unauthenticated storage — passwords are stored in plain text and data does not sync across devices/browsers.
 * Suitable for demo/prototype purposes only, not production use with real users.
 * Note: The Supabase connection / config in the project has been left untouched as it is.
 */

import { CalculatorInput, calculateFootprint, NATIONAL_AVG_KG, GLOBAL_AVG_KG } from './calculator';

export interface LocalUser {
  username: string;
  password?: string;
  createdAt: string;
  name?: string;
}

export interface LocalCarbonEntryItem {
  category: 'transport' | 'energy' | 'diet' | 'waste';
  subcategory: string;
  inputValue: number;
  co2Kg: number;
}

export interface LocalCarbonEntry {
  date: string; // ISO String timestamp of submission
  totalAnnualCo2Kg: number;
  breakdown: {
    transport: number;
    energy: number;
    diet: number;
    waste: number;
  };
  items: LocalCarbonEntryItem[];
}

export interface SummaryResponse {
  latestCalculation: LocalCarbonEntry | null;
  historyTrend: { date: string; total: number }[];
  comparison: {
    nationalAvgKg: number;
    globalAvgKg: number;
    percentVsNational: number;
  };
}

export interface EntriesResponse {
  history: LocalCarbonEntry[];
  totalCount: number;
  page: number;
  limit: number;
}

// Check if localStorage is available
export function isLocalStorageAvailable(): boolean {
  try {
    const key = '__storage_test__';
    window.localStorage.setItem(key, key);
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// Retrieve users array
export function getUsers(): LocalUser[] {
  if (!isLocalStorageAvailable()) return [];
  const usersStr = window.localStorage.getItem('users');
  return usersStr ? JSON.parse(usersStr) : [];
}

// Save users array
function saveUsers(users: LocalUser[]): void {
  if (!isLocalStorageAvailable()) return;
  window.localStorage.setItem('users', JSON.stringify(users));
}

// Register a user
export function registerUser(username: string, password: string, name?: string): LocalUser {
  if (!isLocalStorageAvailable()) {
    throw new Error('Local storage is unavailable in this browser.');
  }

  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  if (!trimmedUsername || !trimmedPassword) {
    throw new Error('Username and password are required.');
  }

  const users = getUsers();
  const exists = users.some(u => u.username.toLowerCase() === trimmedUsername.toLowerCase());
  
  if (exists) {
    throw new Error('Username already exists');
  }

  const newUser: LocalUser = {
    username: trimmedUsername,
    password: trimmedPassword, // Plain text as requested
    name: name?.trim() || trimmedUsername,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  // Automatically log user in
  setCurrentUser(newUser);
  return newUser;
}

// Login a user
export function loginUser(username: string, password: string): LocalUser {
  if (!isLocalStorageAvailable()) {
    throw new Error('Local storage is unavailable in this browser.');
  }

  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  const users = getUsers();
  const matchedUser = users.find(
    u => u.username.toLowerCase() === trimmedUsername.toLowerCase() && u.password === trimmedPassword
  );

  if (!matchedUser) {
    throw new Error('Invalid username or password');
  }

  // Set as current user
  setCurrentUser(matchedUser);
  return matchedUser;
}

// Get the currently logged in user
export function getCurrentUser(): LocalUser | null {
  if (!isLocalStorageAvailable()) return null;
  const userStr = window.localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

// Set current user
export function setCurrentUser(user: LocalUser | null): void {
  if (!isLocalStorageAvailable()) return;
  if (user) {
    window.localStorage.setItem('currentUser', JSON.stringify(user));
  } else {
    window.localStorage.removeItem('currentUser');
  }
}

// Logout current user
export function logoutUser(): void {
  setCurrentUser(null);
}

// Get user specific carbon entries
export function getCarbonEntries(username: string): LocalCarbonEntry[] {
  if (!isLocalStorageAvailable()) return [];
  const entriesStr = window.localStorage.getItem(`carbon_entries_${username.toLowerCase()}`);
  return entriesStr ? JSON.parse(entriesStr) : [];
}

// Save carbon entries array
function saveCarbonEntries(username: string, entries: LocalCarbonEntry[]): void {
  if (!isLocalStorageAvailable()) return;
  window.localStorage.setItem(`carbon_entries_${username.toLowerCase()}`, JSON.stringify(entries));
}

// Save a new carbon entry calculation
export function saveCarbonEntry(username: string, inputs: CalculatorInput): LocalCarbonEntry {
  if (!isLocalStorageAvailable()) {
    throw new Error('Local storage is unavailable.');
  }

  const calcResult = calculateFootprint(inputs);
  const entryDateIso = new Date().toISOString();

  // Create subcategory values aligned with backend
  const items: LocalCarbonEntryItem[] = [
    {
      category: 'transport',
      subcategory: inputs.transport.mode,
      inputValue: inputs.transport.weeklyKm ?? 0,
      co2Kg: calcResult.breakdown.transport
    },
    {
      category: 'energy',
      subcategory: `electricity_grid_in+cooking_${inputs.energy.cookingFuel}${inputs.energy.hasSolar ? '_solar' : ''}`,
      inputValue: inputs.energy.monthlyKwh,
      co2Kg: calcResult.breakdown.energy
    },
    {
      category: 'diet',
      subcategory: `diet_${inputs.diet}`,
      inputValue: 1,
      co2Kg: calcResult.breakdown.diet
    },
    {
      category: 'waste',
      subcategory: inputs.waste,
      inputValue: 1,
      co2Kg: calcResult.breakdown.waste
    }
  ];

  const newEntry: LocalCarbonEntry = {
    date: entryDateIso,
    totalAnnualCo2Kg: calcResult.totalAnnualCo2Kg,
    breakdown: calcResult.breakdown,
    items
  };

  const entries = getCarbonEntries(username);
  // Unshift to keep newest first
  entries.unshift(newEntry);
  saveCarbonEntries(username, entries);

  return newEntry;
}

// Get Paginated entries
export function getPaginatedEntries(username: string, page: number = 1, limit: number = 10): EntriesResponse {
  const entries = getCarbonEntries(username);
  // Sort desc by date
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const skip = (page - 1) * limit;
  const paginated = sorted.slice(skip, skip + limit);

  return {
    history: paginated,
    totalCount: sorted.length,
    page,
    limit
  };
}

// Get Carbon Summary
export function getCarbonSummary(username: string): SummaryResponse {
  const entries = getCarbonEntries(username);
  
  // Sort desc by date
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sorted.length === 0) {
    return {
      latestCalculation: null,
      historyTrend: [],
      comparison: {
        nationalAvgKg: NATIONAL_AVG_KG,
        globalAvgKg: GLOBAL_AVG_KG,
        percentVsNational: 0
      }
    };
  }

  const latestCalculation = sorted[0];
  
  // Chronological last 7 entries (oldest first)
  const historyTrend = sorted
    .slice(0, 7)
    .reverse()
    .map(entry => ({
      date: entry.date.split('T')[0],
      total: entry.totalAnnualCo2Kg
    }));

  const percentVsNational = Math.round(
    ((latestCalculation.totalAnnualCo2Kg - NATIONAL_AVG_KG) / NATIONAL_AVG_KG) * 100
  );

  return {
    latestCalculation,
    historyTrend,
    comparison: {
      nationalAvgKg: NATIONAL_AVG_KG,
      globalAvgKg: GLOBAL_AVG_KG,
      percentVsNational
    }
  };
}

// Delete carbon entry matching date string (could be exact YYYY-MM-DD or full ISO date match prefix)
export function deleteCarbonEntry(username: string, dateStr: string): void {
  const entries = getCarbonEntries(username);
  
  // Filter out entries that match the dateStr (exact or YYYY-MM-DD prefix)
  const filtered = entries.filter(entry => {
    const entryYmd = entry.date.split('T')[0];
    return entry.date !== dateStr && entryYmd !== dateStr;
  });

  saveCarbonEntries(username, filtered);
}
