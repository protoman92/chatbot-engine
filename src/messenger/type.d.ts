export type Context = Readonly<{ [K: string]: unknown }>;

/** Represents a Facebook user. */
export type FacebookUser = Readonly<{
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  id: string;
}>;
