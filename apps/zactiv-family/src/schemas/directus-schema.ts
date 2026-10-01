export interface Log {
  /** @primaryKey */
  id: number
  user_created?: DirectusUser | string | null
  photo?: DirectusFile | string | null
  note?: string | null
  metadata?: Record<string, any> | null
  app_version?: string | null
  platform?: 'web' | 'ios_app' | 'android_app' | null
  event_category?: 'workout' | 'video' | 'recipe' | 'checkin' | null
  started?: string | null
  completed?: string | null
  abandoned?: string | null
  duration?: number | null
  user?: DirectusUser | string | null
  event?: LogsEvent[] | string[]
}

export interface LogsEvent {
  /** @primaryKey */
  id: number
  logs_id?: Log | string | null
  item?: Workout | Recipe | Video | string | null
  collection?: string | null
}

export interface Page {
  /** @primaryKey */
  id: number
  status?: 'published' | 'draft' | 'archived'
  sort?: number | null
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  /** @required */
  slug: string
  title?: string | null
  content?: string | null
  in_nav?: boolean | null
  seo_title?: string | null
  seo_description?: string | null
  /** @description 1200x630 pixels */
  seo_og_image?: DirectusFile | string | null
  requires_auth?: boolean | null
}

export interface Recipe {
  /** @primaryKey */
  id: number
  status?: 'published' | 'draft' | 'archived'
  sort?: number | null
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  name?: string | null
  short_description?: string | null
  time_prep?: number | null
  time_cook?: number | null
  servings_adults_base?: number | null
  servings_children_base?: number | null
  ingredients?: string | null
  instructions?: string | null
  closing_points?: string | null
  kids_help?: string | null
  main_image?: DirectusFile | string | null
  zactivs?: number | null
  images?: RecipesFile[] | string[]
  tags?: RecipesRecipeTag[] | string[]
}

export interface RecipesFile {
  /** @primaryKey */
  id: number
  recipes_id?: Recipe | string | null
  directus_files_id?: DirectusFile | string | null
}

export interface RecipesRecipeTag {
  /** @primaryKey */
  id: number
  recipes_id?: Recipe | string | null
  recipe_tags_id?: RecipeTag | string | null
}

export interface RecipeTag {
  /** @primaryKey */
  id: number
  status?: 'published' | 'draft' | 'archived'
  sort?: number | null
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  image?: DirectusFile | string | null
  file?: DirectusFile | string | null
  name?: string | null
  type?: `meal-type` | `speed-effort` | `dietary-lifestyle` | `family-fun` | `budget-planning` | `style-mood` | 'occasions' | null
}

export interface School {
  /** @primaryKey */
  id: string
  status?: 'active' | 'trial' | 'expired' | 'cancelled' | 'inactive'
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  name?: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  city?: string | null
  county?: string | null
  postcode?: string | null
  slug?: string | null
  users?: DirectusUser[] | string[]
}

export interface Video {
  /** @primaryKey */
  id: number
  status?: 'published' | 'draft' | 'archived'
  sort?: number | null
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  video_file?: DirectusFile | string | null
  name?: string | null
  short_description?: string | null
  description?: string | null
  thumbnail?: DirectusFile | string | null
  portrait?: boolean | null
  zactivs?: number | null
  show_on_home?: boolean | null
  tags?: VideosVideoTag[] | string[]
}

export interface VideosVideoTag {
  /** @primaryKey */
  id: number
  videos_id?: Video | string | null
  video_tags_id?: VideoTag | string | null
}

export interface VideoTag {
  /** @primaryKey */
  id: number
  status?: 'published' | 'draft' | 'archived'
  sort?: number | null
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  name?: string | null
  image?: DirectusFile | string | null
  file?: VideoTagsFile[] | string[]
}

export interface VideoTagsFile {
  /** @primaryKey */
  id: number
  video_tags_id?: VideoTag | string | null
  directus_files_id?: DirectusFile | string | null
}

export interface Workout {
  /** @primaryKey */
  id: number
  status?: 'published' | 'draft' | 'archived'
  sort?: number | null
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  name?: string | null
  warm_up?: string | null
  main_workout?: string | null
  /** @description The length of the workout, leave blank if no time */
  time?: string | null
  start_date?: string | null
  end_date?: string | null
  image?: DirectusFile | string | null
  short_description?: string | null
  more_notes?: string | null
  zactivs?: number | null
  timer_type?: 'countdown' | 'countup' | 'emom' | 'tabata' | null
  /** @description In seconds */
  count_down_time_cap?: number | null
  /** @description In seconds */
  emom_round_duration?: number | null
  emom_rounds?: number | null
  tabata_rounds?: number | null
  /** @description In seconds */
  tabata_work?: number | null
  /** @description In seconds */
  tabata_rest?: number | null
  tags?: WorkoutsWorkoutTag[] | string[]
}

export interface WorkoutsWorkoutTag {
  /** @primaryKey */
  id: number
  workouts_id?: Workout | string | null
  workout_tags_id?: WorkoutTag | string | null
}

export interface WorkoutTag {
  /** @primaryKey */
  id: number
  status?: 'published' | 'draft' | 'archived'
  sort?: number | null
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  name?: string | null
  type?: 'program' | 'for' | `target-area` | 'equipment' | 'exercise' | null
  image?: DirectusFile | string | null
  file?: DirectusFile | string | null
}

export interface ZactivsLedger {
  /** @primaryKey */
  id: number
  user_created?: DirectusUser | string | null
  date_created?: string | null
  user_updated?: DirectusUser | string | null
  date_updated?: string | null
  amount?: number | null
  note?: string | null
  source?: Log | string | null
  event_category?: 'workout' | 'video' | 'recipe' | 'checkin' | 'manual_adjustment' | null
  user?: DirectusUser | string | null
}

export interface DirectusAccess {
  /** @primaryKey */
  id: string
  role?: DirectusRole | string | null
  user?: DirectusUser | string | null
  policy?: DirectusPolicy | string
  sort?: number | null
}

export interface DirectusActivity {
  /** @primaryKey */
  id: number
  action?: string
  user?: DirectusUser | string | null
  timestamp?: string
  ip?: string | null
  user_agent?: string | null
  collection?: string
  item?: string
  origin?: string | null
  revisions?: DirectusRevision[] | string[]
}

export interface DirectusCollection {
  /** @primaryKey */
  collection: string
  icon?: string | null
  note?: string | null
  display_template?: string | null
  hidden?: boolean
  singleton?: boolean
  translations?: Array<{ language: string, translation: string, singular: string, plural: string }> | null
  archive_field?: string | null
  archive_app_filter?: boolean
  archive_value?: string | null
  unarchive_value?: string | null
  sort_field?: string | null
  accountability?: 'all' | 'activity' | null | null
  color?: string | null
  item_duplication_fields?: 'json' | null
  sort?: number | null
  group?: DirectusCollection | string | null
  collapse?: string
  preview_url?: string | null
  versioning?: boolean
}

export interface DirectusComment {
  /** @primaryKey */
  id: string
  collection?: DirectusCollection | string
  item?: string
  comment?: string
  date_created?: string | null
  date_updated?: string | null
  user_created?: DirectusUser | string | null
  user_updated?: DirectusUser | string | null
}

export interface DirectusField {
  /** @primaryKey */
  id: number
  collection?: DirectusCollection | string
  field?: string
  special?: string[] | null
  interface?: string | null
  options?: 'json' | null
  display?: string | null
  display_options?: 'json' | null
  readonly?: boolean
  hidden?: boolean
  sort?: number | null
  width?: string | null
  translations?: 'json' | null
  note?: string | null
  conditions?: 'json' | null
  required?: boolean | null
  group?: DirectusField | string | null
  validation?: 'json' | null
  validation_message?: string | null
}

export interface DirectusFile {
  /** @primaryKey */
  id: string
  storage?: string
  filename_disk?: string | null
  filename_download?: string
  title?: string | null
  type?: string | null
  folder?: DirectusFolder | string | null
  uploaded_by?: DirectusUser | string | null
  created_on?: string
  modified_by?: DirectusUser | string | null
  modified_on?: string
  charset?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  duration?: number | null
  embed?: string | null
  description?: string | null
  location?: string | null
  tags?: string[] | null
  metadata?: 'json' | null
  focal_point_x?: number | null
  focal_point_y?: number | null
  tus_id?: string | null
  tus_data?: 'json' | null
  uploaded_on?: string | null
}

export interface DirectusFolder {
  /** @primaryKey */
  id: string
  name?: string
  parent?: DirectusFolder | string | null
}

export interface DirectusMigration {
  /** @primaryKey */
  version: string
  name?: string
  timestamp?: string | null
}

export interface DirectusPermission {
  /** @primaryKey */
  id: number
  collection?: string
  action?: string
  permissions?: 'json' | null
  validation?: 'json' | null
  presets?: 'json' | null
  fields?: string[] | null
  policy?: DirectusPolicy | string
}

export interface DirectusPolicy {
  /** @primaryKey */
  id: string
  /** @required */
  name: string
  icon?: string
  description?: string | null
  ip_access?: string[] | null
  enforce_tfa?: boolean
  admin_access?: boolean
  app_access?: boolean
  permissions?: DirectusPermission[] | string[]
  users?: DirectusAccess[] | string[]
  roles?: DirectusAccess[] | string[]
}

export interface DirectusPreset {
  /** @primaryKey */
  id: number
  bookmark?: string | null
  user?: DirectusUser | string | null
  role?: DirectusRole | string | null
  collection?: string | null
  search?: string | null
  layout?: string | null
  layout_query?: 'json' | null
  layout_options?: 'json' | null
  refresh_interval?: number | null
  filter?: 'json' | null
  icon?: string | null
  color?: string | null
}

export interface DirectusRelation {
  /** @primaryKey */
  id: number
  many_collection?: string
  many_field?: string
  one_collection?: string | null
  one_field?: string | null
  one_collection_field?: string | null
  one_allowed_collections?: string[] | null
  junction_field?: string | null
  sort_field?: string | null
  one_deselect_action?: string
}

export interface DirectusRevision {
  /** @primaryKey */
  id: number
  activity?: DirectusActivity | string
  collection?: string
  item?: string
  data?: 'json' | null
  delta?: 'json' | null
  parent?: DirectusRevision | string | null
  version?: DirectusVersion | string | null
}

export interface DirectusRole {
  /** @primaryKey */
  id: string
  /** @required */
  name: string
  icon?: string
  description?: string | null
  parent?: DirectusRole | string | null
  children?: DirectusRole[] | string[]
  policies?: DirectusAccess[] | string[]
  users?: DirectusUser[] | string[]
}

export interface DirectusSession {
  /** @primaryKey */
  token: string
  user?: DirectusUser | string | null
  expires?: string
  ip?: string | null
  user_agent?: string | null
  share?: DirectusShare | string | null
  origin?: string | null
  next_token?: string | null
}

export interface DirectusSettings {
  /** @primaryKey */
  id: number
  project_name?: string
  project_url?: string | null
  project_color?: string
  project_logo?: DirectusFile | string | null
  public_foreground?: DirectusFile | string | null
  public_background?: DirectusFile | string | null
  public_note?: string | null
  auth_login_attempts?: number | null
  auth_password_policy?: null | `/^.{8,}$/` | `/(?=^.{8,}$)(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+}{';'?>.<,])(?!.*\\s).*$/` | null
  storage_asset_transform?: 'all' | 'none' | 'presets' | null
  storage_asset_presets?: Array<{ key: string, fit: 'contain' | 'cover' | 'inside' | 'outside', width: number, height: number, quality: number, withoutEnlargement: boolean, format: 'auto' | 'jpeg' | 'png' | 'webp' | 'tiff' | 'avif', transforms: 'json' }> | null
  custom_css?: string | null
  storage_default_folder?: DirectusFolder | string | null
  basemaps?: Array<{ name: string, type: 'raster' | 'tile' | 'style', url: string, tileSize: number, attribution: string }> | null
  mapbox_key?: string | null
  module_bar?: 'json' | null
  project_descriptor?: string | null
  default_language?: string
  custom_aspect_ratios?: Array<{ text: string, value: number }> | null
  public_favicon?: DirectusFile | string | null
  default_appearance?: 'auto' | 'light' | 'dark'
  default_theme_light?: string | null
  theme_light_overrides?: 'json' | null
  default_theme_dark?: string | null
  theme_dark_overrides?: 'json' | null
  report_error_url?: string | null
  report_bug_url?: string | null
  report_feature_url?: string | null
  public_registration?: boolean
  public_registration_verify_email?: boolean
  public_registration_role?: DirectusRole | string | null
  public_registration_email_filter?: 'json' | null
  visual_editor_urls?: Array<{ url: string }> | null
  accepted_terms?: boolean | null
  project_id?: string | null
  mcp_enabled?: boolean
  mcp_allow_deletes?: boolean
  mcp_prompts_collection?: string | null
  mcp_system_prompt_enabled?: boolean
  mcp_system_prompt?: string | null
}

export interface DirectusUser {
  /** @primaryKey */
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  password?: string | null
  location?: string | null
  title?: string | null
  description?: string | null
  tags?: string[] | null
  avatar?: DirectusFile | string | null
  language?: string | null
  tfa_secret?: string | null
  status?: 'draft' | 'invited' | 'unverified' | 'active' | 'suspended' | 'archived'
  role?: DirectusRole | string | null
  token?: string | null
  last_access?: string | null
  last_page?: string | null
  provider?: string
  external_identifier?: string | null
  auth_data?: 'json' | null
  email_notifications?: boolean | null
  appearance?: null | 'auto' | 'light' | 'dark' | null
  theme_dark?: string | null
  theme_light?: string | null
  theme_light_overrides?: 'json' | null
  theme_dark_overrides?: 'json' | null
  text_direction?: 'auto' | 'ltr' | 'rtl'
  zactivs_balance?: number | null
  timezone?: string | null
  school?: School | string | null
  family_name?: string | null
  logs?: Log[] | string[]
  policies?: DirectusAccess[] | string[]
}

export interface DirectusWebhook {
  /** @primaryKey */
  id: number
  name?: string
  method?: null
  url?: string
  status?: 'active' | 'inactive'
  data?: boolean
  actions?: 'create' | 'update' | 'delete'
  collections?: string[]
  headers?: Array<{ header: string, value: string }> | null
  was_active_before_deprecation?: boolean
  migrated_flow?: DirectusFlow | string | null
}

export interface DirectusDashboard {
  /** @primaryKey */
  id: string
  name?: string
  icon?: string
  note?: string | null
  date_created?: string | null
  user_created?: DirectusUser | string | null
  color?: string | null
  panels?: DirectusPanel[] | string[]
}

export interface DirectusPanel {
  /** @primaryKey */
  id: string
  dashboard?: DirectusDashboard | string
  name?: string | null
  icon?: string | null
  color?: string | null
  show_header?: boolean
  note?: string | null
  type?: string
  position_x?: number
  position_y?: number
  width?: number
  height?: number
  options?: 'json' | null
  date_created?: string | null
  user_created?: DirectusUser | string | null
}

export interface DirectusNotification {
  /** @primaryKey */
  id: number
  timestamp?: string | null
  status?: string | null
  recipient?: DirectusUser | string
  sender?: DirectusUser | string | null
  subject?: string
  message?: string | null
  collection?: string | null
  item?: string | null
}

export interface DirectusShare {
  /** @primaryKey */
  id: string
  name?: string | null
  collection?: DirectusCollection | string
  item?: string
  role?: DirectusRole | string | null
  password?: string | null
  user_created?: DirectusUser | string | null
  date_created?: string | null
  date_start?: string | null
  date_end?: string | null
  times_used?: number | null
  max_uses?: number | null
}

export interface DirectusFlow {
  /** @primaryKey */
  id: string
  name?: string
  icon?: string | null
  color?: string | null
  description?: string | null
  status?: string
  trigger?: string | null
  accountability?: string | null
  options?: 'json' | null
  operation?: DirectusOperation | string | null
  date_created?: string | null
  user_created?: DirectusUser | string | null
  operations?: DirectusOperation[] | string[]
}

export interface DirectusOperation {
  /** @primaryKey */
  id: string
  name?: string | null
  key?: string
  type?: string
  position_x?: number
  position_y?: number
  options?: 'json' | null
  resolve?: DirectusOperation | string | null
  reject?: DirectusOperation | string | null
  flow?: DirectusFlow | string
  date_created?: string | null
  user_created?: DirectusUser | string | null
}

export interface DirectusTranslation {
  /** @primaryKey */
  id: string
  /** @required */
  language: string
  /** @required */
  key: string
  /** @required */
  value: string
}

export interface DirectusVersion {
  /** @primaryKey */
  id: string
  key?: string
  name?: string | null
  collection?: DirectusCollection | string
  item?: string
  hash?: string | null
  date_created?: string | null
  date_updated?: string | null
  user_created?: DirectusUser | string | null
  user_updated?: DirectusUser | string | null
  delta?: 'json' | null
}

export interface DirectusExtension {
  enabled?: boolean
  /** @primaryKey */
  id: string
  folder?: string
  source?: string
  bundle?: string | null
}

export interface Schema {
  logs: Log[]
  logs_event: LogsEvent[]
  pages: Page[]
  recipes: Recipe[]
  recipes_files: RecipesFile[]
  recipes_recipe_tags: RecipesRecipeTag[]
  recipe_tags: RecipeTag[]
  school: School[]
  videos: Video[]
  videos_video_tags: VideosVideoTag[]
  video_tags: VideoTag[]
  video_tags_files: VideoTagsFile[]
  workouts: Workout[]
  workouts_workout_tags: WorkoutsWorkoutTag[]
  workout_tags: WorkoutTag[]
  zactivs_ledger: ZactivsLedger[]
  directus_access: DirectusAccess[]
  directus_activity: DirectusActivity[]
  directus_collections: DirectusCollection[]
  directus_comments: DirectusComment[]
  directus_fields: DirectusField[]
  directus_files: DirectusFile[]
  directus_folders: DirectusFolder[]
  directus_migrations: DirectusMigration[]
  directus_permissions: DirectusPermission[]
  directus_policies: DirectusPolicy[]
  directus_presets: DirectusPreset[]
  directus_relations: DirectusRelation[]
  directus_revisions: DirectusRevision[]
  directus_roles: DirectusRole[]
  directus_sessions: DirectusSession[]
  directus_settings: DirectusSettings
  directus_users: DirectusUser[]
  directus_webhooks: DirectusWebhook[]
  directus_dashboards: DirectusDashboard[]
  directus_panels: DirectusPanel[]
  directus_notifications: DirectusNotification[]
  directus_shares: DirectusShare[]
  directus_flows: DirectusFlow[]
  directus_operations: DirectusOperation[]
  directus_translations: DirectusTranslation[]
  directus_versions: DirectusVersion[]
  directus_extensions: DirectusExtension[]
}

export enum CollectionNames {
  logs = 'logs',
  logs_event = 'logs_event',
  pages = 'pages',
  recipes = 'recipes',
  recipes_files = 'recipes_files',
  recipes_recipe_tags = 'recipes_recipe_tags',
  recipe_tags = 'recipe_tags',
  school = 'school',
  videos = 'videos',
  videos_video_tags = 'videos_video_tags',
  video_tags = 'video_tags',
  video_tags_files = 'video_tags_files',
  workouts = 'workouts',
  workouts_workout_tags = 'workouts_workout_tags',
  workout_tags = 'workout_tags',
  zactivs_ledger = 'zactivs_ledger',
  directus_access = 'directus_access',
  directus_activity = 'directus_activity',
  directus_collections = 'directus_collections',
  directus_comments = 'directus_comments',
  directus_fields = 'directus_fields',
  directus_files = 'directus_files',
  directus_folders = 'directus_folders',
  directus_migrations = 'directus_migrations',
  directus_permissions = 'directus_permissions',
  directus_policies = 'directus_policies',
  directus_presets = 'directus_presets',
  directus_relations = 'directus_relations',
  directus_revisions = 'directus_revisions',
  directus_roles = 'directus_roles',
  directus_sessions = 'directus_sessions',
  directus_settings = 'directus_settings',
  directus_users = 'directus_users',
  directus_webhooks = 'directus_webhooks',
  directus_dashboards = 'directus_dashboards',
  directus_panels = 'directus_panels',
  directus_notifications = 'directus_notifications',
  directus_shares = 'directus_shares',
  directus_flows = 'directus_flows',
  directus_operations = 'directus_operations',
  directus_translations = 'directus_translations',
  directus_versions = 'directus_versions',
  directus_extensions = 'directus_extensions',
}
