export type Member = {
  id: string;
  household_id: string;
  name: string;
  colour: string;
  role: "adult" | "child";
  user_id: string | null;
  sort_order: number;
  avatar: string | null;
  photo_path: string | null;
};

export type Household = {
  id: string;
  name: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
};

export type ShoppingItem = {
  id: string;
  household_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: string | null;
  checked: boolean;
  checked_at: string | null;
  usual: boolean;
  meal_plan_id: string | null;
  added_by: string | null;
  created_at: string;
};

export type PlannerEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  rrule: string | null;
  location: string | null;
  notes: string | null;
  event_members: { member_id: string }[];
};

// One appearance of an event on the calendar; repeating events have many
export type Occurrence = {
  key: string;
  event: PlannerEvent;
  start: Date;
  end: Date;
  memberIds: string[];
};

export type Dinner = {
  id: string;
  date: string;
  note: string | null;
  recipe_id: string | null;
  recipes: { title: string } | null;
};
