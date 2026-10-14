import { PortfolioArchiveView, archiveMetadata, parseArchivePage } from '@/views/PortfolioArchiveView'

export const generateMetadata = () => archiveMetadata('en', 'objects')

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = searchParams ? await searchParams : {}
  return <PortfolioArchiveView locale="en" page={parseArchivePage(resolved.page)} section="objects" />
}
