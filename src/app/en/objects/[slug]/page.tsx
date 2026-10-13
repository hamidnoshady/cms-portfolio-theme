import { CaseStudyView, caseMetadata } from '@/views/CaseStudyView'
export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  return caseMetadata('en', 'objects', decodeURIComponent(slug))
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CaseStudyView locale="en" section="objects" slug={decodeURIComponent(slug)} />
}
