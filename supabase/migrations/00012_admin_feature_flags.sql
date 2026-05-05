-- Global, read-only feature flag / config table surfaced to the client via a
-- small API route. Holds UI layout defaults (dock edge, auto-open, etc.) and
-- operational knobs (max concurrent jobs, etc.) that are safe to tweak without
-- shipping code. Values are stored as `jsonb` so each flag can express rich
-- shapes (booleans, numbers, objects) without needing a new column.
--
-- Not meant for per-user preferences — those stay in localStorage / zustand
-- persist stores (dock-store, editor-settings-store). Think of this as "server
-- config a logged-in client can read".

CREATE TABLE IF NOT EXISTS public.admin_feature_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_feature_flags IS
  'Server-side UI and behavior flags. Read-only for authenticated clients.';

ALTER TABLE public.admin_feature_flags ENABLE ROW LEVEL SECURITY;

-- Read access for any authenticated user. Writes are intentionally gated so
-- only the Supabase service-role (or SQL admin) can mutate this table.
DROP POLICY IF EXISTS admin_feature_flags_read ON public.admin_feature_flags;
CREATE POLICY admin_feature_flags_read
  ON public.admin_feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed sensible defaults so the DockRail works out-of-the-box without a
-- manual insert. The client hook uses hardcoded fallbacks on top of these,
-- so the app still boots cleanly if the table is unreachable. Defaults put
-- Activity on the left and Properties on the right so canvas stays centered
-- and both panels can coexist without fighting for space.
INSERT INTO public.admin_feature_flags (key, value) VALUES
  ('dock.panels.properties.edge',              '"right"'::jsonb),
  ('dock.panels.activity.edge',                '"left"'::jsonb),
  ('dock.default_width',                       '300'::jsonb),
  ('dock.properties.auto_open_on_select',      'true'::jsonb),
  ('dock.auto_open_activity_on_first_batch',   'true'::jsonb),
  ('dock.min_screen_for_both_open',            '1280'::jsonb),
  ('dock.resize_enabled',                      'true'::jsonb),
  ('dock.keyboard_shortcuts',                  'false'::jsonb),
  ('jobs.max_concurrent',                      '4'::jsonb)
ON CONFLICT (key) DO NOTHING;
