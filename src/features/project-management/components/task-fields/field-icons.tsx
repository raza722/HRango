// Icons of the task column cells and popups, cut from the Workspace file's exports
// (HRango2/Design/project-management/svg: ws-task-row-group_1-2779, ws-add-assignee-v3_1-21985,
// ws-start-date-calendar_1-10061). Single-colour icons draw in currentColor. The ones marked
// "lucide" have no exported frame yet.
import type { SVGProps } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  Copy,
  EllipsisVertical,
  File,
  FileSpreadsheet,
  FileText,
  Image,
  Info,
  ListTree,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Plus,
  Settings,
  Star,
  Tag,
  Timer,
  Trash2,
} from 'lucide-react'

type IconProps = SVGProps<SVGSVGElement>

const lucide = { strokeWidth: 1.75, 'aria-hidden': true, focusable: false } as const

/** The cells' purple chevron (Dropdown Arrow Button). */
export function ChevronDownIcon(props: IconProps) {
  return (
    <svg
      viewBox="1139.4 109.4 20.2 11.7"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M1141 111L1149.5 119.5L1158 111"
        strokeWidth="2.83333"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      />
    </svg>
  )
}

export function ChevronUpIcon({ style, ...props }: IconProps) {
  return <ChevronDownIcon style={{ transform: 'rotate(180deg)', ...style }} {...props} />
}

/** Description (three lines, #B07542 on #FFEEE7 after a task's name). */
export function DescriptionIcon(props: IconProps) {
  return (
    <svg
      viewBox="493.5 108.6 21.7 12.8"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M514.342 110.285H494.371C493.916 110.285 493.539 109.908 493.539 109.453C493.539 108.998 493.916 108.62 494.371 108.62H514.342C514.797 108.62 515.174 108.998 515.174 109.453C515.174 109.908 514.797 110.285 514.342 110.285Z"
        fill="currentColor"
      />
      <path
        d="M504.878 115.832H494.371C493.916 115.832 493.539 115.455 493.539 115C493.539 114.545 493.916 114.168 494.371 114.168H504.878C505.333 114.168 505.71 114.545 505.71 115C505.71 115.455 505.344 115.832 504.878 115.832Z"
        fill="currentColor"
      />
      <path
        d="M514.342 121.379H494.371C493.916 121.379 493.539 121.002 493.539 120.547C493.539 120.092 493.916 119.715 494.371 119.715H514.342C514.797 119.715 515.174 120.092 515.174 120.547C515.174 121.002 514.797 121.379 514.342 121.379Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** The status radio of the status chips (ring and dot, Status Icon Button). */
export function StatusRingIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="11.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="6" fill="currentColor" />
    </svg>
  )
}

/** Waiting On (Stop): a sand disc with a brown stop square, as the Dependencies layers colour it. */
export function WaitingOnIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false" {...props}>
      <circle cx="11" cy="11" r="11" fill="#F3DFB5" />
      <rect x="7" y="7" width="8" height="8" rx="1.5" fill="#946602" />
    </svg>
  )
}

/** Blocking (Pause). */
export function BlockingIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false" {...props}>
      <circle cx="11" cy="11" r="11" fill="#F9D4D5" />
      <rect x="7.5" y="6.5" width="2.5" height="9" rx="1" fill="#B7192C" />
      <rect x="12" y="6.5" width="2.5" height="9" rx="1" fill="#B7192C" />
    </svg>
  )
}

/** The Priority popup's Clear: a red circle with a bar. */
export function ClearIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M6 18 18 6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/** Milestone: a diamond. */
export function MilestoneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <rect
        x="12"
        y="2.5"
        width="13.4"
        height="13.4"
        rx="2"
        transform="rotate(45 12 2.5)"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  )
}

// lucide stand-ins (frames not exported yet)
export const ChevronRightIcon = (props: IconProps) => <ChevronRight {...lucide} {...props} />
export const BackIcon = (props: IconProps) => <ArrowLeft {...lucide} {...props} />
export const TagIcon = (props: IconProps) => <Tag {...lucide} {...props} />
export const MoreIcon = (props: IconProps) => (
  <MoreHorizontal {...lucide} strokeWidth={3} {...props} />
)
export const MoreVerticalIcon = (props: IconProps) => <EllipsisVertical {...lucide} {...props} />
export const PlusIcon = (props: IconProps) => <Plus {...lucide} strokeWidth={2} {...props} />
export const GearIcon = (props: IconProps) => <Settings {...lucide} {...props} />
export const InfoIcon = (props: IconProps) => <Info {...lucide} {...props} />
export const StarIcon = (props: IconProps) => <Star {...lucide} {...props} />
export const PlayIcon = (props: IconProps) => <Play {...lucide} fill="currentColor" {...props} />
export const PauseIcon = (props: IconProps) => <Pause {...lucide} fill="currentColor" {...props} />
export const TimerIcon = (props: IconProps) => <Timer {...lucide} {...props} />
export const CopyIcon = (props: IconProps) => <Copy {...lucide} {...props} />
export const CommentIcon = (props: IconProps) => <MessageSquareText {...lucide} {...props} />
export const SubtaskIcon = (props: IconProps) => <ListTree {...lucide} {...props} />
export const AttachIcon = (props: IconProps) => <Paperclip {...lucide} {...props} />
/** The third-party sources' logos are raster images in the design; a cloud stands in. */
export const CloudSourceIcon = (props: IconProps) => <Cloud {...lucide} {...props} />
export const DeleteIcon = (props: IconProps) => <Trash2 {...lucide} {...props} />
export const PdfFileIcon = (props: IconProps) => <FileText {...lucide} {...props} />
export const SheetFileIcon = (props: IconProps) => <FileSpreadsheet {...lucide} {...props} />
export const ImageFileIcon = (props: IconProps) => <Image {...lucide} {...props} />
export const DocFileIcon = (props: IconProps) => <FileText {...lucide} {...props} />
export const GenericFileIcon = (props: IconProps) => <File {...lucide} {...props} />

// --- cut from the exports -------------------------------------------------------------------------

/** Search (bold search-normal, #A181FF in the search fields). */
export function SearchIcon(props: IconProps) {
  return (
    <svg
      viewBox="28.49 102.47 19.44 19.11"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M37.6861 120.621C42.7638 120.621 46.8801 116.558 46.8801 111.545C46.8801 106.532 42.7638 102.469 37.6861 102.469C32.6085 102.469 28.4922 106.532 28.4922 111.545C28.4922 116.558 32.6085 120.621 37.6861 120.621Z"
        fill="currentColor"
      />
      <path
        d="M47.1812 121.577C47.007 121.577 46.8328 121.51 46.707 121.386L44.9069 119.609C44.6456 119.351 44.6456 118.93 44.9069 118.663C45.1682 118.405 45.594 118.405 45.865 118.663L47.6651 120.44C47.9264 120.698 47.9264 121.118 47.6651 121.386C47.5296 121.51 47.3554 121.577 47.1812 121.577Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Invite (user with a plus). */
export function InviteIcon(props: IconProps) {
  return (
    <svg
      viewBox="589.06 169.96 16.9 18.08"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M596.919 179.632C594.253 179.632 592.084 177.463 592.084 174.797C592.084 172.132 594.253 169.963 596.919 169.963C599.584 169.963 601.753 172.132 601.753 174.797C601.753 177.463 599.584 179.632 596.919 179.632ZM596.919 171.224C594.951 171.224 593.345 172.83 593.345 174.797C593.345 176.765 594.951 178.371 596.919 178.371C598.886 178.371 600.492 176.765 600.492 174.797C600.492 172.83 598.886 171.224 596.919 171.224Z"
        fill="currentColor"
      />
      <path
        d="M601.963 188.04C600.971 188.04 600.03 187.67 599.298 187.006C599.004 186.754 598.743 186.443 598.541 186.098C598.171 185.492 597.97 184.778 597.97 184.046C597.97 182.995 598.373 182.012 599.096 181.263C599.853 180.481 600.87 180.052 601.963 180.052C603.107 180.052 604.192 180.54 604.931 181.381C605.587 182.112 605.957 183.054 605.957 184.046C605.957 184.366 605.915 184.685 605.831 184.988C605.747 185.366 605.587 185.761 605.369 186.106C604.671 187.3 603.359 188.04 601.963 188.04ZM601.963 181.314C601.215 181.314 600.526 181.608 600.004 182.138C599.508 182.65 599.231 183.323 599.231 184.046C599.231 184.542 599.365 185.03 599.626 185.45C599.761 185.686 599.937 185.896 600.139 186.073C600.643 186.535 601.291 186.787 601.963 186.787C602.914 186.787 603.813 186.283 604.301 185.467C604.444 185.232 604.553 184.963 604.612 184.702C604.671 184.483 604.696 184.273 604.696 184.055C604.696 183.382 604.444 182.735 603.99 182.23C603.485 181.642 602.745 181.314 601.963 181.314Z"
        fill="currentColor"
      />
      <path
        d="M589.693 188.04C589.348 188.04 589.062 187.754 589.062 187.409C589.062 183.819 592.585 180.893 596.916 180.893C597.765 180.893 598.597 181.003 599.404 181.23C599.741 181.322 599.934 181.667 599.842 182.003C599.749 182.339 599.404 182.533 599.068 182.44C598.379 182.247 597.655 182.154 596.916 182.154C593.283 182.154 590.324 184.509 590.324 187.409C590.324 187.754 590.038 188.04 589.693 188.04Z"
        fill="currentColor"
      />
      <path
        d="M601.963 185.946C601.619 185.946 601.333 185.661 601.333 185.316V182.802C601.333 182.457 601.619 182.171 601.963 182.171C602.308 182.171 602.594 182.457 602.594 182.802V185.316C602.594 185.669 602.308 185.946 601.963 185.946Z"
        fill="currentColor"
      />
      <path
        d="M603.223 184.66H600.709C600.364 184.66 600.078 184.374 600.078 184.029C600.078 183.685 600.364 183.399 600.709 183.399H603.223C603.568 183.399 603.853 183.685 603.853 184.029C603.853 184.374 603.568 184.66 603.223 184.66Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Close (x), red in the popups. */
export function CloseIcon(props: IconProps) {
  return (
    <svg
      viewBox="644.31 37.64 15.39 15.38"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M646.383 52.5715C645.934 53.02 645.206 53.02 644.758 52.5715C644.31 52.1232 644.31 51.396 644.758 50.9475L646.383 52.5715ZM659.246 50.9475C659.694 51.396 659.694 52.1231 659.246 52.5715C658.798 53.0199 658.071 53.0197 657.622 52.5715L659.246 50.9475ZM657.622 38.0833C658.071 37.6352 658.798 37.635 659.246 38.0833C659.695 38.5317 659.695 39.2598 659.246 39.7083L653.626 45.3274L659.246 50.9475L658.434 51.759L657.622 52.5715L652.002 46.9514L646.383 52.5715L645.57 51.759L644.758 50.9475L650.377 45.3274L644.758 39.7083L644.68 39.6204C644.312 39.1693 644.337 38.5037 644.758 38.0833C645.178 37.6628 645.844 37.6372 646.295 38.0051L646.383 38.0833L652.002 43.7024L657.622 38.0833Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Calendar (the date cells and fields). */
export function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="926 105.31 19.5 21.5" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M931.75 109.81C931.34 109.81 931 109.47 931 109.06V106.06C931 105.65 931.34 105.31 931.75 105.31C932.16 105.31 932.5 105.65 932.5 106.06V109.06C932.5 109.47 932.16 109.81 931.75 109.81Z"
        fill="currentColor"
      />
      <path
        d="M939.75 109.81C939.34 109.81 939 109.47 939 109.06V106.06C939 105.65 939.34 105.31 939.75 105.31C940.16 105.31 940.5 105.65 940.5 106.06V109.06C940.5 109.47 940.16 109.81 939.75 109.81Z"
        fill="currentColor"
      />
      <path
        d="M932.25 118.56C932.12 118.56 931.99 118.53 931.87 118.48C931.74 118.43 931.64 118.36 931.54 118.27C931.36 118.08 931.25 117.83 931.25 117.56C931.25 117.43 931.28 117.3 931.33 117.18C931.38 117.06 931.45 116.95 931.54 116.85C931.64 116.76 931.74 116.69 931.87 116.64C932.23 116.49 932.68 116.57 932.96 116.85C933.14 117.04 933.25 117.3 933.25 117.56C933.25 117.62 933.24 117.69 933.23 117.76C933.22 117.82 933.2 117.88 933.17 117.94C933.15 118 933.12 118.06 933.08 118.12C933.05 118.17 933 118.22 932.96 118.27C932.77 118.45 932.51 118.56 932.25 118.56Z"
        fill="currentColor"
      />
      <path
        d="M935.75 118.56C935.62 118.56 935.49 118.53 935.37 118.48C935.24 118.43 935.14 118.36 935.04 118.27C934.86 118.08 934.75 117.83 934.75 117.56C934.75 117.43 934.78 117.3 934.83 117.18C934.88 117.06 934.95 116.95 935.04 116.85C935.14 116.76 935.24 116.69 935.37 116.64C935.73 116.48 936.18 116.57 936.46 116.85C936.64 117.04 936.75 117.3 936.75 117.56C936.75 117.62 936.74 117.69 936.73 117.76C936.72 117.82 936.7 117.88 936.67 117.94C936.65 118 936.62 118.06 936.58 118.12C936.55 118.17 936.5 118.22 936.46 118.27C936.27 118.45 936.01 118.56 935.75 118.56Z"
        fill="currentColor"
      />
      <path
        d="M939.25 118.56C939.12 118.56 938.99 118.53 938.87 118.48C938.74 118.43 938.64 118.36 938.54 118.27C938.5 118.22 938.46 118.17 938.42 118.12C938.38 118.06 938.35 118 938.33 117.94C938.3 117.88 938.28 117.82 938.27 117.76C938.26 117.69 938.25 117.62 938.25 117.56C938.25 117.3 938.36 117.04 938.54 116.85C938.64 116.76 938.74 116.69 938.87 116.64C939.24 116.48 939.68 116.57 939.96 116.85C940.14 117.04 940.25 117.3 940.25 117.56C940.25 117.62 940.24 117.69 940.23 117.76C940.22 117.82 940.2 117.88 940.17 117.94C940.15 118 940.12 118.06 940.08 118.12C940.05 118.17 940 118.22 939.96 118.27C939.77 118.45 939.51 118.56 939.25 118.56Z"
        fill="currentColor"
      />
      <path
        d="M932.25 122.06C932.12 122.06 931.99 122.03 931.87 121.98C931.75 121.93 931.64 121.86 931.54 121.77C931.36 121.58 931.25 121.32 931.25 121.06C931.25 120.93 931.28 120.8 931.33 120.68C931.38 120.55 931.45 120.44 931.54 120.35C931.91 119.98 932.59 119.98 932.96 120.35C933.14 120.54 933.25 120.8 933.25 121.06C933.25 121.32 933.14 121.58 932.96 121.77C932.77 121.95 932.51 122.06 932.25 122.06Z"
        fill="currentColor"
      />
      <path
        d="M935.75 122.06C935.49 122.06 935.23 121.95 935.04 121.77C934.86 121.58 934.75 121.32 934.75 121.06C934.75 120.93 934.78 120.8 934.83 120.68C934.88 120.55 934.95 120.44 935.04 120.35C935.41 119.98 936.09 119.98 936.46 120.35C936.55 120.44 936.62 120.55 936.67 120.68C936.72 120.8 936.75 120.93 936.75 121.06C936.75 121.32 936.64 121.58 936.46 121.77C936.27 121.95 936.01 122.06 935.75 122.06Z"
        fill="currentColor"
      />
      <path
        d="M939.25 122.06C938.99 122.06 938.73 121.95 938.54 121.77C938.45 121.68 938.38 121.57 938.33 121.44C938.28 121.32 938.25 121.19 938.25 121.06C938.25 120.93 938.28 120.8 938.33 120.68C938.38 120.55 938.45 120.44 938.54 120.35C938.77 120.12 939.12 120.01 939.44 120.08C939.51 120.09 939.57 120.11 939.63 120.14C939.69 120.16 939.75 120.19 939.81 120.23C939.86 120.26 939.91 120.31 939.96 120.35C940.14 120.54 940.25 120.8 940.25 121.06C940.25 121.32 940.14 121.58 939.96 121.77C939.77 121.95 939.51 122.06 939.25 122.06Z"
        fill="currentColor"
      />
      <path
        d="M944.25 113.9H927.25C926.84 113.9 926.5 113.56 926.5 113.15C926.5 112.74 926.84 112.4 927.25 112.4H944.25C944.66 112.4 945 112.74 945 113.15C945 113.56 944.66 113.9 944.25 113.9Z"
        fill="currentColor"
      />
      <path
        d="M939.75 126.81H931.75C928.1 126.81 926 124.71 926 121.06V112.56C926 108.91 928.1 106.81 931.75 106.81H939.75C943.4 106.81 945.5 108.91 945.5 112.56V121.06C945.5 124.71 943.4 126.81 939.75 126.81ZM931.75 108.31C928.89 108.31 927.5 109.7 927.5 112.56V121.06C927.5 123.92 928.89 125.31 931.75 125.31H939.75C942.61 125.31 944 123.92 944 121.06V112.56C944 109.7 942.61 108.31 939.75 108.31H931.75Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Priority flag. */
export function FlagIcon(props: IconProps) {
  return (
    <svg
      viewBox="1211.97 105.06 15.8 22"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M1212.74 127.06C1212.32 127.06 1211.97 126.713 1211.97 126.293V105.828C1211.97 105.408 1212.32 105.06 1212.74 105.06C1213.16 105.06 1213.5 105.408 1213.5 105.828V126.293C1213.5 126.713 1213.16 127.06 1212.74 127.06Z"
        fill="currentColor"
      />
      <path
        d="M1224.2 120.921H1212.74C1212.32 120.921 1211.97 120.573 1211.97 120.153C1211.97 119.734 1212.32 119.386 1212.74 119.386H1224.2C1225.31 119.386 1225.83 119.089 1225.94 118.833C1226.04 118.578 1225.89 118.004 1225.09 117.217L1223.86 115.989C1223.36 115.549 1223.05 114.884 1223.02 114.147C1222.99 113.369 1223.3 112.602 1223.86 112.039L1225.09 110.811C1225.84 110.054 1226.08 109.44 1225.97 109.174C1225.85 108.908 1225.27 108.642 1224.2 108.642H1212.74C1212.31 108.642 1211.97 108.294 1211.97 107.874C1211.97 107.455 1212.32 107.107 1212.74 107.107H1224.2C1226.44 107.107 1227.15 108.038 1227.39 108.591C1227.61 109.143 1227.77 110.31 1226.17 111.906L1224.94 113.134C1224.69 113.39 1224.54 113.748 1224.55 114.106C1224.57 114.413 1224.69 114.689 1224.9 114.884L1226.17 116.142C1227.74 117.708 1227.58 118.874 1227.36 119.437C1227.12 119.979 1226.4 120.921 1224.2 120.921Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Dependency warning (#B0A042 on #FFF9E7 after a task name). */
export function WarningIcon(props: IconProps) {
  return (
    <svg viewBox="538 105 20.5 20" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M547.967 117.428C547.605 117.428 547.305 117.128 547.305 116.766V112.351C547.305 111.989 547.605 111.689 547.967 111.689C548.329 111.689 548.629 111.989 548.629 112.351V116.766C548.629 117.128 548.329 117.428 547.967 117.428Z"
        fill="currentColor"
      />
      <path
        d="M547.969 120.298C547.916 120.298 547.855 120.289 547.793 120.28C547.74 120.271 547.687 120.253 547.634 120.227C547.581 120.209 547.528 120.183 547.475 120.147C547.431 120.112 547.387 120.077 547.343 120.042C547.184 119.874 547.086 119.644 547.086 119.415C547.086 119.185 547.184 118.955 547.343 118.788C547.387 118.752 547.431 118.717 547.475 118.682C547.528 118.646 547.581 118.62 547.634 118.602C547.687 118.576 547.74 118.558 547.793 118.549C547.908 118.523 548.031 118.523 548.137 118.549C548.199 118.558 548.252 118.576 548.305 118.602C548.358 118.62 548.411 118.646 548.464 118.682C548.508 118.717 548.552 118.752 548.596 118.788C548.755 118.955 548.852 119.185 548.852 119.415C548.852 119.644 548.755 119.874 548.596 120.042C548.552 120.077 548.508 120.112 548.464 120.147C548.411 120.183 548.358 120.209 548.305 120.227C548.252 120.253 548.199 120.271 548.137 120.28C548.084 120.289 548.022 120.298 547.969 120.298Z"
        fill="currentColor"
      />
      <path
        d="M553.318 123.972H542.616C540.894 123.972 539.578 123.345 538.907 122.214C538.245 121.084 538.333 119.627 539.172 118.117L544.523 108.492C545.406 106.903 546.625 106.028 547.967 106.028C549.309 106.028 550.528 106.903 551.411 108.492L556.762 118.126C557.601 119.636 557.698 121.084 557.027 122.223C556.356 123.345 555.04 123.972 553.318 123.972ZM547.967 107.353C547.137 107.353 546.324 107.989 545.68 109.137L540.338 118.771C539.737 119.848 539.64 120.837 540.055 121.552C540.47 122.267 541.388 122.656 542.625 122.656H553.327C554.563 122.656 555.473 122.267 555.897 121.552C556.32 120.837 556.214 119.857 555.614 118.771L550.254 109.137C549.609 107.989 548.797 107.353 547.967 107.353Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Link (#427FB0 on #E7F1FF after a task name). */
export function LinkIcon(props: IconProps) {
  return (
    <svg viewBox="580.5 104.7 20 20.6" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M588.691 116.677C590.312 118.298 592.94 118.298 594.561 116.677L598.753 112.485C600.374 110.864 600.374 108.236 598.753 106.615C597.133 104.994 594.505 104.994 592.884 106.615L590.788 108.711M592.051 113.323C590.43 111.702 587.802 111.702 586.182 113.323L581.989 117.515C580.368 119.136 580.368 121.764 581.989 123.385C583.61 125.006 586.238 125.006 587.859 123.385L589.955 121.289"
        strokeWidth="1.77874"
        strokeLinecap="round"
        stroke="currentColor"
      />
    </svg>
  )
}

/** Add Time (timer-start). */
export function ClockIcon(props: IconProps) {
  return (
    <svg viewBox="79.11 195.26 17.5 20" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M87.8633 201.26V206.26"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      />
      <path
        d="M87.8633 215.26C83.0333 215.26 79.1133 211.34 79.1133 206.51C79.1133 201.68 83.0333 197.76 87.8633 197.76C92.6933 197.76 96.6133 201.68 96.6133 206.51"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      />
      <path
        d="M84.8633 195.26H90.8633"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      />
      <path
        d="M90.7617 211.761V210.601C90.7617 209.171 91.7817 208.581 93.0217 209.301L94.0217 209.881L95.0217 210.461C96.2617 211.181 96.2617 212.351 95.0217 213.071L94.0217 213.651L93.0217 214.231C91.7817 214.951 90.7617 214.361 90.7617 212.931V211.761Z"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      />
    </svg>
  )
}

/** A set priority's flag, filled (ws-priority-flag_1-11487; drawn in the priority's colour). */
export function FlagFilledIcon(props: IconProps) {
  return (
    <svg viewBox="9.8 8 15.9 22.1" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M10.6503 30.0604C10.2307 30.0604 9.88281 29.7125 9.88281 29.293V8.82787C9.88281 8.40833 10.2307 8.06042 10.6503 8.06042C11.0698 8.06042 11.4177 8.40833 11.4177 8.82787V29.293C11.4177 29.7125 11.0698 30.0604 10.6503 30.0604Z"
        fill="currentColor"
      />
      <path
        d="M23.9141 10.9999H10.9141V22.9999H22.9141L24.9141 21.9999L21.4141 16.9999L24.9141 12.4999L23.9141 10.9999Z"
        fill="currentColor"
      />
      <path
        d="M22.1107 23.9208H10.6503C10.2307 23.9208 9.88281 23.5729 9.88281 23.1533C9.88281 22.7338 10.2307 22.3859 10.6503 22.3859H22.1107C23.2261 22.3859 23.7479 22.0891 23.8503 21.8333C23.9526 21.5775 23.7991 21.0045 23.001 20.2166L21.773 18.9887C21.2717 18.5487 20.9647 17.8836 20.934 17.1468C20.9033 16.3691 21.2103 15.6017 21.773 15.0389L23.001 13.811C23.7582 13.0538 23.9935 12.4398 23.881 12.1738C23.7684 11.9077 23.1851 11.6417 22.1107 11.6417H10.6503C10.2205 11.6417 9.88281 11.2938 9.88281 10.8743C9.88281 10.4547 10.2307 10.1068 10.6503 10.1068H22.1107C24.3517 10.1068 25.0679 11.038 25.3033 11.5905C25.5284 12.1431 25.6819 13.3096 24.0856 14.9059L22.8577 16.1338C22.6019 16.3896 22.4586 16.7477 22.4689 17.1059C22.4791 17.4129 22.6019 17.6891 22.8168 17.8836L24.0856 19.1422C25.6512 20.7077 25.4977 21.8743 25.2726 22.437C25.0372 22.9794 24.3107 23.9208 22.1107 23.9208Z"
        fill="currentColor"
      />
    </svg>
  )
}
