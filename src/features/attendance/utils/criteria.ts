import {
  type AudienceCriteria,
  type AudienceTarget,
  type GeoFenceSetting,
  type GeoFenceSettingInput,
  type IpRestriction,
  type IpRestrictionInput,
  TARGET_TYPES,
  type TargetType,
  VALUE_TARGET_TYPES,
} from '../types/settings.types'

/** Nothing chosen for any kind of target. */
export function emptyCriteria(): AudienceCriteria {
  return Object.fromEntries(TARGET_TYPES.map((type) => [type, []])) as unknown as AudienceCriteria
}

const isValueType = (type: TargetType) => VALUE_TARGET_TYPES.includes(type)

/** The API's flat target list → the chosen values per kind. */
export function toCriteria(
  targets: readonly AudienceTarget[] | null | undefined,
): AudienceCriteria {
  const criteria = emptyCriteria()
  for (const target of targets ?? []) {
    const value = isValueType(target.targetType) ? target.targetValue : target.targetId
    if (value && !criteria[target.targetType].includes(value)) {
      criteria[target.targetType].push(value)
    }
  }
  return criteria
}

/** The chosen values per kind → one target per value, as the API takes them. */
export function toTargets(criteria: AudienceCriteria): AudienceTarget[] {
  return TARGET_TYPES.flatMap((targetType) =>
    criteria[targetType].map((value) =>
      isValueType(targetType)
        ? { targetType, targetId: null, targetValue: value }
        : { targetType, targetId: value, targetValue: null },
    ),
  )
}

export const criteriaIsEmpty = (criteria: AudienceCriteria) =>
  TARGET_TYPES.every((type) => criteria[type].length === 0)

/** A saved IP restriction as the body of its PUT (with its rowVersion). */
export function restrictionInput(record: IpRestriction): IpRestrictionInput {
  return {
    ipv4: record.ipv4,
    ipv6: record.ipv6,
    netmask: record.netmask,
    rangeStart: record.rangeStart,
    rangeEnd: record.rangeEnd,
    appliesToAll: record.appliesToAll,
    isActive: record.isActive,
    targets: record.appliesToAll ? [] : (record.targets ?? []),
    rowVersion: record.rowVersion,
  }
}

/** A saved geo fence as the body of its PUT (with its rowVersion). */
export function fenceInput(record: GeoFenceSetting): GeoFenceSettingInput {
  return {
    name: record.name,
    shape: record.shape,
    centerLat: record.centerLat,
    centerLng: record.centerLng,
    radiusM: record.radiusM,
    polygonPoints: record.polygonPoints,
    appliesToAll: record.appliesToAll,
    joiningFromDate: record.joiningFromDate,
    joiningToDate: record.joiningToDate,
    isForShift: record.isForShift,
    isActive: record.isActive,
    targets: record.appliesToAll ? [] : (record.targets ?? []),
    rowVersion: record.rowVersion,
  }
}

/** Nationality is free text in the API; the picker offers these. */
export const NATIONALITIES = [
  'Afghan',
  'American',
  'Bangladeshi',
  'British',
  'Canadian',
  'Chinese',
  'Egyptian',
  'Emirati',
  'Filipino',
  'Indian',
  'Iranian',
  'Jordanian',
  'Malaysian',
  'Nepali',
  'Pakistani',
  'Saudi',
  'Sri Lankan',
  'Turkish',
] as const
