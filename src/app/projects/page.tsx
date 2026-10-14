import { PortfolioArchiveView, archiveMetadata, parseArchivePage } from '@/views/PortfolioArchiveView'

export const generateMetadata = () => archiveMetadata('fa', 'projects')

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = searchParams ? await searchParams : {}
  return <PortfolioArchiveView locale="fa" page={parseArchivePage(resolved.page)} section="projects" />
}
