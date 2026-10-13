import { PortfolioArchiveView, archiveMetadata } from '@/views/PortfolioArchiveView'
export const generateMetadata = () => archiveMetadata('fa', 'projects')
export default function Page() { return <PortfolioArchiveView locale="fa" section="projects" /> }
