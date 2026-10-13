import { CareersView, careersMetadata } from '@/views/CareersView'
export const generateMetadata = () => careersMetadata('fa')
export default function Page() { return <CareersView locale="fa" /> }
