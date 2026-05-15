-- New fill-in-the-blank profile prompt fields.
-- company and industry remain in the DB for backwards compat but are removed from the UI.
ALTER TABLE users ADD COLUMN IF NOT EXISTS currently_into    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ask_me_about      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS next_on_list      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS know_a_lot_about  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cities_know_well  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS moving_to_city    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS travel_motivations text[];
