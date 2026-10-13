/**
 * The subset of the Eshobe CMS Theme API (`contractVersion = 1`) this theme consumes.
 *
 * Types here mirror `docs/THEME_API.md` §4–§12 and the CMS collections: `pages`,
 * `posts`, `categories`, `media`, `header`/`footer` singletons, `forms`,
 * `form-submissions`. Nothing is invented: where the contract has no field, the type
 * says so (see `ProjectMetadata` — it exists on posts, and there is deliberately no
 * team/statistics/service collection).
 */

export type Locale = 'fa' | 'en'
export type SiteType = 'business' | 'portfolio' | 'store'
export type SiteStatus = 'active' | 'suspended' | 'archived'

export type Media = {
  id: string
  url?: null | string
  alt?: null | string
  caption?: unknown
  width?: null | number
  height?: null | number
  mimeType?: null | string
  filesize?: null | number
  focalX?: null | number
  focalY?: null | number
  updatedAt?: null | string
  sizes?: null | Record<string, { url?: null | string; width?: null | number; height?: null | number }>
}

export type MediaRef = Media | string | null | undefined

export type LinkReference = {
  relationTo: 'pages' | 'posts'
  value: string | { id: string; slug?: null | string; title?: null | string }
}

export type CmsLink = {
  type?: 'custom' | 'reference'
  label?: null | string
  url?: null | string
  newTab?: null | boolean
  appearance?: 'default' | 'outline' | null
  reference?: LinkReference | null
}

export type NavItem = { id?: string; link?: CmsLink | null }

export type HeaderDoc = { id: string; navItems?: NavItem[] | null; updatedAt?: string }
export type FooterDoc = { id: string; navItems?: NavItem[] | null; updatedAt?: string }

export type BrandingMedia = Media | null

export type Branding = {
  displayName: null | string
  shortName: null | string
  tagline: null | string
  primaryLogo: BrandingMedia
  compactLogo: BrandingMedia
  homeLogo: BrandingMedia
  lightLogo: BrandingMedia
  darkLogo: BrandingMedia
  favicon: BrandingMedia
  socialImage: BrandingMedia
  /** Aliases the CMS sends alongside the fields above. */
  displayNameFa: null | string
  logo: BrandingMedia
  logoCompact: BrandingMedia
  defaultOgImage: BrandingMedia
}

export type SiteDescriptor = {
  availableLocales: Locale[]
  blocks: string[]
  contractVersion: number
  defaultLocale: Locale
  domain: string
  media: { basePath: string; origin: string }
  branding: Branding | null
  name: string
  slug: string
  status: SiteStatus
  store: { currency: 'IRT' | 'IRR' | 'USD' | 'EUR'; paymentProvider?: null | string }
  payments?: { currency: string; methods?: unknown }
  theme: {
    accent?: null | string
    background?: null | string
    foreground?: null | string
    lineHeight?: null | number
    primary?: null | string
    radius?: 'lg' | 'md' | 'none' | 'sm' | null
  } | null
  themeRuntime: null | {
    theme: { key: null | string }
    package: { key: null | string }
    settings: Record<string, boolean | number | string>
    bindings: Record<string, null | { id: string; type: 'page' | 'post' | 'category' | 'form' | 'media'; slug: null | string; title: null | string }>
  }
  type: SiteType
  /** Present only when the request was resolved by a site API key. */
  id?: string
  domainVerified?: boolean
}

export type LexicalNode = { type?: string; text?: string; children?: LexicalNode[]; [key: string]: unknown }
export type RichText = null | { root?: { children?: LexicalNode[]; direction?: 'ltr' | 'rtl' | null } }

export type MetaGroup = {
  title?: null | string
  description?: null | string
  image?: MediaRef
}

export type PageDoc = {
  id: string
  title: string
  slug: string
  hero?: null | {
    type?: 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact' | null
    richText?: RichText
    links?: { link?: CmsLink | null }[] | null
    media?: MediaRef
  }
  layout?: BlockRow[] | null
  meta?: null | MetaGroup
  publishedAt?: null | string
  updatedAt?: string
  _status?: 'draft' | 'published'
}

export type PostDoc = {
  id: string
  title: string
  slug: string
  heroImage?: MediaRef
  content?: RichText
  categories?: (CategoryDoc | string)[] | null
  relatedPosts?: (PostDoc | string)[] | null
  projectMetadata?: null | ProjectMetadata
  meta?: null | MetaGroup
  publishedAt?: null | string
  updatedAt?: string
  populatedAuthors?: { id?: null | string; name?: null | string }[] | null
  authors?: ({ id?: string; name?: string } | string)[] | null
  _status?: 'draft' | 'published'
}

/**
 * `posts.projectMetadata` — the only structured project facts the contract exposes.
 * Every field is optional, and the theme renders a facts table **only** for fields the
 * CMS actually returned; nothing is inferred from the narrative.
 */
export type ProjectMetadata = {
  location?: null | string
  date?: null | string
  area?: null | string
  status?: null | string
  client?: null | string
  additionalFacts?: { label?: null | string; value?: null | string }[] | null
}

export type CategoryDoc = {
  id: string
  title: string
  slug: string
  parent?: CategoryDoc | string | null
  breadcrumbs?: { doc?: string; url?: null | string; label?: null | string }[] | null
  updatedAt?: string
}

export type Paginated<T> = {
  docs: T[]
  totalDocs: number
  totalPages: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
  nextPage: null | number
  prevPage: null | number
}

export type BlockRow = { id?: string; blockType?: string; [key: string]: unknown }

export type FormFieldOption = { label: string; value: string }

export type FormField = {
  id?: string
  blockName?: null | string
  name: string
  label?: null | string
  required?: null | boolean
  width?: null | number
  defaultValue?: unknown
  fieldType?: 'checkbox' | 'country' | 'email' | 'message' | 'number' | 'select' | 'state' | 'text' | 'textarea' | null
  options?: FormFieldOption[] | null
}

export type FormDoc = {
  id: string
  title: string
  fields?: FormField[] | null
  submitButtonLabel?: null | string
  confirmationType?: 'message' | 'redirect' | null
  confirmationMessage?: RichText
  redirect?: { url?: null | string } | null
  updatedAt?: string
}

export type FindResult<T> = Paginated<T>
