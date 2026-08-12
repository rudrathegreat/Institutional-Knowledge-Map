export interface PeopleFilterState {
  groupIds: string[];
  titles: string[];
  researchAreas: string[];
}

export interface PeopleFilterOption {
  value: string;
  label: string;
}

export interface PeopleFilterOptions {
  groups: PeopleFilterOption[];
  titles: string[];
  researchAreas: string[];
}

export interface FilterablePerson {
  title: string;
  researchAreas: string[];
  researchGroups?: Array<{ id: string; name: string }>;
}

export type PeopleFilterSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const EMPTY_PEOPLE_FILTERS: PeopleFilterState = {
  groupIds: [],
  titles: [],
  researchAreas: [],
};

const FILTER_QUERY_KEYS = {
  groupIds: "group",
  titles: "title",
  researchAreas: "area",
} as const;

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText);
}

export function derivePeopleFilterOptions(
  people: FilterablePerson[],
): PeopleFilterOptions {
  const groupsById = new Map<string, string>();

  for (const person of people) {
    for (const group of person.researchGroups ?? []) {
      groupsById.set(group.id, group.name);
    }
  }

  return {
    groups: [...groupsById]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => compareText(left.label, right.label)),
    titles: uniqueSorted(people.map(({ title }) => title)),
    researchAreas: uniqueSorted(
      people.flatMap(({ researchAreas }) => researchAreas),
    ),
  };
}

function valuesFromSearchParams(
  searchParams: URLSearchParams | PeopleFilterSearchParams,
  key: string,
): string[] {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.getAll(key);
  }

  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

function validValues(values: string[], options: string[]): string[] {
  const selected = new Set(values);
  return options.filter((option) => selected.has(option));
}

export function parsePeopleFilters(
  searchParams: URLSearchParams | PeopleFilterSearchParams,
  options: PeopleFilterOptions,
): PeopleFilterState {
  return {
    groupIds: validValues(
      valuesFromSearchParams(searchParams, FILTER_QUERY_KEYS.groupIds),
      options.groups.map(({ value }) => value),
    ),
    titles: validValues(
      valuesFromSearchParams(searchParams, FILTER_QUERY_KEYS.titles),
      options.titles,
    ),
    researchAreas: validValues(
      valuesFromSearchParams(searchParams, FILTER_QUERY_KEYS.researchAreas),
      options.researchAreas,
    ),
  };
}

export function updatePeopleFilterSearchParams(
  searchParams: URLSearchParams,
  filters: PeopleFilterState,
): URLSearchParams {
  const updated = new URLSearchParams(searchParams);

  for (const key of Object.values(FILTER_QUERY_KEYS)) {
    updated.delete(key);
  }

  for (const value of uniqueSorted(filters.groupIds)) {
    updated.append(FILTER_QUERY_KEYS.groupIds, value);
  }
  for (const value of uniqueSorted(filters.titles)) {
    updated.append(FILTER_QUERY_KEYS.titles, value);
  }
  for (const value of uniqueSorted(filters.researchAreas)) {
    updated.append(FILTER_QUERY_KEYS.researchAreas, value);
  }

  return updated;
}

export function matchesPeopleFilters(
  person: FilterablePerson,
  filters: PeopleFilterState,
): boolean {
  const matchesGroup =
    filters.groupIds.length === 0 ||
    (person.researchGroups ?? []).some(({ id }) =>
      filters.groupIds.includes(id),
    );
  const matchesTitle =
    filters.titles.length === 0 || filters.titles.includes(person.title);
  const matchesResearchArea =
    filters.researchAreas.length === 0 ||
    person.researchAreas.some((area) =>
      filters.researchAreas.includes(area),
    );

  return matchesGroup && matchesTitle && matchesResearchArea;
}

export function countActivePeopleFilters(filters: PeopleFilterState): number {
  return (
    filters.groupIds.length +
    filters.titles.length +
    filters.researchAreas.length
  );
}

export function hasActivePeopleFilters(filters: PeopleFilterState): boolean {
  return countActivePeopleFilters(filters) > 0;
}
