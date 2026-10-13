import { CaseStudyView, caseMetadata } from '@/views/CaseStudyView'
export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  return caseMetadata('fa', 'objects', decodeURIComponent(slug))
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CaseStudyView locale="fa" section="objects" slug={decodeURIComponent(slug)} />
}
