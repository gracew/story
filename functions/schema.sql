CREATE TABLE blocks (
    id SERIAL NOT NULL,
    user_ids text[]
);
ALTER TABLE ONLY blocks ADD CONSTRAINT pk_blocks_id PRIMARY KEY (id);
CREATE INDEX idx_blocks_user_ids ON blocks USING gin (user_ids);


CREATE TABLE date_users (
    id SERIAL NOT NULL,
    user_id text NOT NULL,
    date_id text NOT NULL,
    canceled_at timestamp without time zone,
    joined_at timestamp without time zone
);


ALTER TABLE ONLY date_users ADD CONSTRAINT pk_date_users_id PRIMARY KEY (id);
CREATE INDEX idx_date_users_user_id ON date_users USING btree (user_id);
CREATE UNIQUE INDEX unq_date_users ON date_users USING btree (date_id, user_id);


CREATE TABLE dates (
    id text NOT NULL,
    meeting_type text NOT NULL,
    meeting_time timestamp with time zone,
    interactions jsonb,
    meeting_metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone
);

ALTER TABLE ONLY dates ADD CONSTRAINT pk_dates_id PRIMARY KEY (id);

CREATE TABLE locations (
    id SERIAL NOT NULL,
    name text NOT NULL,
    timezone text NOT NULL
);
ALTER TABLE ONLY locations ADD CONSTRAINT pk_locations_id PRIMARY KEY (id);


CREATE TABLE match_preferences (
    user_id text NOT NULL,
    interested_in_genders text[] NOT NULL,
    connection_types text[] NOT NULL,
    drugs_alcohol_dealbreakers text[] NOT NULL,
    drugs_alcohol_profile text[] NOT NULL,
    kids_dealbreakers text[] NOT NULL,
    kids_profile text[] NOT NULL,
    politics_dealbreakers text[] NOT NULL,
    politics_profile text[] NOT NULL,
    relation_type text DEFAULT 'monogamous'::text NOT NULL,
    religion_dealbreakers text[] NOT NULL,
    religion_profile text,
    smoking_dealbreakers text[] NOT NULL,
    smoking_profile text[] NOT NULL
);


ALTER TABLE ONLY match_preferences ADD CONSTRAINT pk_match_preferences_user_id PRIMARY KEY (user_id);

CREATE TABLE users (
    id text NOT NULL,
    first_name text NOT NULL,
    last_name text,
    is_eligible boolean NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fun_facts text[],
    gender text NOT NULL,
    interests_blurb text,
    twitter_handle text,
    referral_code text,
    heard_about_us_thru text,
    linkedin_url text,
    location text,
    status text,
    location_id_unused integer,
    phone text,
    email text,
    ethnicity_code text,
    is_ethnicity_self_reported boolean
);
ALTER TABLE ONLY users ADD CONSTRAINT pk_users_id PRIMARY KEY (id);
CREATE INDEX idx_users_location_id ON users USING btree (location_id_unused);

CREATE TABLE weekly_call_optins (
    id SERIAL NOT NULL,
    user_id text NOT NULL,
    num_matches integer,
    reminded_at timestamp without time zone,
    requested_at timestamp without time zone,
    responded_at timestamp without time zone,
    available_times timestamp with time zone[],
    week date
);
ALTER TABLE ONLY weekly_call_optins ADD CONSTRAINT pk_weekly_call_optins_id PRIMARY KEY (id);
CREATE INDEX idx_weekly_call_optins_user_id ON weekly_call_optins USING btree (user_id);
CREATE INDEX idx_weekly_call_optins_week ON weekly_call_optins USING btree (week);
