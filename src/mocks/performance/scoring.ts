/*
 * How the mock scores an appraisal. The API spec gives the numbers (goalsScore, selfScore,
 * managerScore, finalScore, finalRatingLabel) but not the formulas; these are the usual ones and
 * are documented in the README:
 * - a review's score is its ratings' average weighted by the criteria weights (rated ones only);
 * - the goals score is the goals' progress weighted by goal weight (cancelled goals left out),
 *   put on the rating scale: lowest level at 0 %, highest at 100 %;
 * - the suggested final score is `goalsWeight` % goals score + the rest manager score (the
 *   manager score alone when there are no goals);
 * - the rating label is the highest level at or below the score.
 */

export interface Level {
  score: number
  label: string
  description: string | null
}

export interface ScoredCriterion {
  weight: number
  rating: number | null
}

export interface ScoredGoal {
  weight: number
  progress: number
  status: string
}

export const round2 = (value: number) => Math.round(value * 100) / 100

/** Weighted average of the rated criteria; null when none is rated. */
export function reviewScore(rows: readonly ScoredCriterion[]): number | null {
  const rated = rows.filter((row): row is { weight: number; rating: number } => row.rating !== null)
  const weight = rated.reduce((sum, row) => sum + row.weight, 0)
  if (rated.length === 0 || weight <= 0) return null
  return round2(rated.reduce((sum, row) => sum + row.rating * row.weight, 0) / weight)
}

/** Progress (0–100) weighted by goal weight; cancelled goals do not count. */
export function weightedProgress(goals: readonly ScoredGoal[]): number | null {
  const counted = goals.filter((goal) => goal.status !== 'cancelled')
  const weight = counted.reduce((sum, goal) => sum + goal.weight, 0)
  if (counted.length === 0) return null
  if (weight <= 0) return round2(counted.reduce((sum, g) => sum + g.progress, 0) / counted.length)
  return round2(counted.reduce((sum, goal) => sum + goal.progress * goal.weight, 0) / weight)
}

export const scaleRange = (levels: readonly Level[]) => {
  const scores = levels.map((level) => level.score)
  return { min: Math.min(...scores), max: Math.max(...scores) }
}

/** The goals' weighted progress on the rating scale. */
export function goalsScore(goals: readonly ScoredGoal[], levels: readonly Level[]): number | null {
  const progress = weightedProgress(goals)
  if (progress === null || levels.length === 0) return null
  const { min, max } = scaleRange(levels)
  return round2(min + (progress / 100) * (max - min))
}

export function suggestedFinal(
  goalsWeight: number,
  goals: number | null,
  manager: number | null,
): number | null {
  if (manager === null) return goals
  if (goals === null || goalsWeight <= 0) return manager
  return round2((goalsWeight / 100) * goals + (1 - goalsWeight / 100) * manager)
}

/** The highest level at or below the score (the lowest level below the scale). */
export function ratingLabel(levels: readonly Level[], score: number | null): string | null {
  if (score === null || levels.length === 0) return null
  const sorted = [...levels].sort((a, b) => a.score - b.score)
  return (
    [...sorted].reverse().find((level) => level.score <= score)?.label ?? sorted[0]?.label ?? null
  )
}
