import { PortfolioArchiveView, archiveMetadata } from '@/views/PortfolioArchiveView'
export const generateMetadata = () => archiveMetadata('en', 'objects')
export default function Page() { return <PortfolioArchiveView locale="en" section="objects" /> }
