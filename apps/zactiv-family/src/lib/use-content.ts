import { useQuery } from '@tanstack/react-query'
import { readPage, readRecipe, readRecipes, readVideo, readVideos, readWorkout, readWorkouts } from '@/lib/content-api'

export const contentKeys = {
  workouts: ['workouts'] as const,
  workout: (id: string) => ['workouts', id] as const,
  recipes: ['recipes'] as const,
  recipe: (id: string) => ['recipes', id] as const,
  videos: ['videos'] as const,
  video: (id: string) => ['videos', id] as const,
  page: (slug: string) => ['pages', slug] as const,
}

export function useWorkoutsQuery() {
  return useQuery({ queryKey: contentKeys.workouts, queryFn: readWorkouts })
}

export function useWorkoutQuery(id: string) {
  return useQuery({ queryKey: contentKeys.workout(id), queryFn: () => readWorkout(id) })
}

export function useRecipesQuery() {
  return useQuery({ queryKey: contentKeys.recipes, queryFn: readRecipes })
}

export function useRecipeQuery(id: string) {
  return useQuery({ queryKey: contentKeys.recipe(id), queryFn: () => readRecipe(id) })
}

export function useVideosQuery() {
  return useQuery({ queryKey: contentKeys.videos, queryFn: readVideos })
}

export function useVideoQuery(id: string) {
  return useQuery({ queryKey: contentKeys.video(id), queryFn: () => readVideo(id) })
}

export function usePageQuery(slug: string) {
  return useQuery({ queryKey: contentKeys.page(slug), queryFn: () => readPage(slug) })
}
