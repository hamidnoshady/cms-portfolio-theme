import { PortfolioArchiveView, archiveMetadata } from '@/views/PortfolioArchiveView'
export const generateMetadata = () => archiveMetadata('fa', 'objects')
export default function Page() { return <PortfolioArchiveView locale="fa" section="objects" /> }
