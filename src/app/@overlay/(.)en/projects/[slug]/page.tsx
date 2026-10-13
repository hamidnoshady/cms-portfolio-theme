import { CaseStudyView, caseMetadata } from '@/views/CaseStudyView'

/**
 * Intercepted case study — `/en/projects` reached by clicking a canvas tile.
 *
 * Next renders this into the root layout's `@overlay` slot instead of replacing the
 * page, so the home canvas (and its position on the field) survives underneath while
 * the URL, the document title and the history entry are the real ones. A direct visit
 * or a refresh never hits this file: it renders `app/en/projects/page.tsx`, the full
 * server-rendered page with the interior chrome.
 */
export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  return caseMetadata('en', 'projects', decodeURIComponent(slug))
}

export default async function InterceptedCaseStudy({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CaseStudyView locale="en" section="projects" slug={decodeURIComponent(slug)} variant="overlay" />
}
