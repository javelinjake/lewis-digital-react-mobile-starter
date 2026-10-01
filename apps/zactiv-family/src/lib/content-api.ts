import type { DirectusFile, Page, Recipe, RecipesFile, School, Video, Workout } from '@/schemas/directus-schema'
import { readItem, readItems } from '@directus/sdk'
import { fileId, tagNames } from '@/lib/assets'
import { parseMinutes } from '@/lib/content-text'
import { getDirectus, getPublicDirectus } from '@/lib/directus/client'
import { workoutSummaryTagGroups } from '@/lib/tags'
import { mimeTypeFromFile, videoLayoutFromFile } from '@/lib/video-source'
import { CollectionNames } from '@/schemas/directus-schema'

export interface WorkoutView {
  id: number
  name: string
  description: string
  time: string
  minutes: number | null
  image: string
  tags: string[]
  tagGroups: ReturnType<typeof workoutSummaryTagGroups>
  zactivs: number
  warmUp: string
  mainWorkout: string
  notes: string
  timerType: 'countdown' | 'countup' | 'emom' | 'tabata' | null
  countDownTimeCap: number | null
  emomRoundDuration: number | null
  emomRounds: number | null
  tabataRounds: number | null
  tabataWork: number | null
  tabataRest: number | null
}

export interface RecipeView {
  id: number
  name: string
  description: string
  minutes: number | null
  servings: number
  image: string
  images: string[]
  tags: string[]
  zactivs: number
  ingredients: string
  instructions: string
  closing: string
}

export interface VideoView {
  id: number
  name: string
  description: string
  image: string
  file: string
  mimeType?: string
  portrait: boolean
  aspectRatio: string
  tags: string[]
  zactivs: number
  showOnHome: boolean
}

const videoFileFields = ['id', 'type', 'filename_download', 'width', 'height'] as const

const published = { status: { _eq: 'published' as const } }

const listItems = readItems as (collection: string, query?: Record<string, unknown>) => unknown
const oneItem = readItem as (collection: string, id: string, query?: Record<string, unknown>) => unknown

async function query<T>(request: unknown) {
  return getDirectus().request(request as never) as Promise<T>
}

async function queryPublic<T>(request: unknown) {
  return getPublicDirectus().request(request as never) as Promise<T>
}

function workoutView(item: Workout): WorkoutView {
  return {
    id: item.id,
    name: item.name || 'Workout',
    description: item.short_description || '',
    time: item.time || '',
    minutes: parseMinutes(item.time),
    image: fileId(item.image),
    tags: tagNames(item.tags, 'workout_tags_id'),
    tagGroups: workoutSummaryTagGroups(item.tags),
    zactivs: item.zactivs || 0,
    warmUp: item.warm_up || '',
    mainWorkout: item.main_workout || '',
    notes: item.more_notes || '',
    timerType: item.timer_type ?? null,
    countDownTimeCap: item.count_down_time_cap ?? null,
    emomRoundDuration: item.emom_round_duration ?? null,
    emomRounds: item.emom_rounds ?? null,
    tabataRounds: item.tabata_rounds ?? null,
    tabataWork: item.tabata_work ?? null,
    tabataRest: item.tabata_rest ?? null,
  }
}

function recipeImages(item: Recipe) {
  const ids = new Set<string>()
  const main = fileId(item.main_image)
  if (main)
    ids.add(main)

  if (Array.isArray(item.images)) {
    for (const row of item.images) {
      const file = (row as RecipesFile).directus_files_id
      const id = fileId(file as DirectusFile | string | null)
      if (id)
        ids.add(id)
    }
  }

  return [...ids]
}

const recipeFields = [
  '*',
  { main_image: ['id'] as const },
  { images: [{ directus_files_id: ['id'] as const }] },
  { tags: [{ recipe_tags_id: ['name', 'type'] as const }] },
]

function recipeView(item: Recipe): RecipeView {
  const prep = item.time_prep || 0
  const cook = item.time_cook || 0
  const images = recipeImages(item)
  return {
    id: item.id,
    name: item.name || 'Recipe',
    description: item.short_description || '',
    minutes: prep + cook || null,
    servings: item.servings_adults_base || 2,
    image: images[0] || '',
    images,
    tags: tagNames(item.tags, 'recipe_tags_id'),
    zactivs: item.zactivs || 0,
    ingredients: item.ingredients || '',
    instructions: item.instructions || '',
    closing: item.closing_points || '',
  }
}

function videoView(item: Video): VideoView {
  const videoFile = item.video_file as DirectusFile | string | null | undefined
  const layout = videoLayoutFromFile(videoFile, item.portrait)

  return {
    id: item.id,
    name: item.name || 'Video',
    description: item.short_description || item.description || '',
    image: fileId(item.thumbnail),
    file: fileId(videoFile),
    mimeType: mimeTypeFromFile(videoFile),
    portrait: layout.portrait,
    aspectRatio: layout.aspectRatio,
    tags: tagNames(item.tags, 'video_tags_id'),
    zactivs: item.zactivs || 0,
    showOnHome: item.show_on_home === true,
  }
}

export async function readWorkouts() {
  const items = await query<Workout[]>(listItems(CollectionNames.workouts, {
    filter: published,
    sort: ['sort', '-date_created'],
    fields: ['*', { tags: [{ workout_tags_id: ['name', 'type'] }] }],
  }))
  return items.map(workoutView)
}

export async function readWorkout(id: string) {
  const item = await query<Workout>(oneItem(CollectionNames.workouts, id, {
    fields: ['*', { tags: [{ workout_tags_id: ['name', 'type'] }] }],
  }))
  return workoutView(item)
}

export async function readRecipes() {
  const items = await query<Recipe[]>(listItems(CollectionNames.recipes, {
    filter: published,
    sort: ['sort', '-date_created'],
    fields: recipeFields,
  }))
  return items.map(recipeView)
}

export async function readRecipe(id: string) {
  const item = await query<Recipe>(oneItem(CollectionNames.recipes, id, {
    fields: recipeFields,
  }))
  return recipeView(item)
}

export async function readVideos() {
  const items = await query<Video[]>(listItems(CollectionNames.videos, {
    filter: published,
    sort: ['sort', '-date_created'],
    fields: ['*', { video_file: videoFileFields }, { tags: [{ video_tags_id: ['name'] }] }],
  }))
  return items.map(videoView)
}

export async function readVideo(id: string) {
  const item = await query<Video>(oneItem(CollectionNames.videos, id, {
    fields: ['*', { video_file: videoFileFields }, { tags: [{ video_tags_id: ['name'] }] }],
  }))
  return videoView(item)
}

export async function readPage(slug: string) {
  const items = await queryPublic<Page[]>(listItems(CollectionNames.pages, {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    limit: 1,
  }))
  return items[0] ?? null
}

export async function readSchool(slug: string) {
  const items = await queryPublic<School[]>(listItems(CollectionNames.school, {
    filter: { slug: { _eq: slug } },
    limit: 1,
  }))
  return items[0] ?? null
}
