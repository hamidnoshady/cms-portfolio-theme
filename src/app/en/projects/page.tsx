import { PortfolioArchiveView, archiveMetadata } from '@/views/PortfolioArchiveView'
export const generateMetadata = () => archiveMetadata('en', 'projects')
export default function Page() { return <PortfolioArchiveView locale="en" section="projects" /> }
