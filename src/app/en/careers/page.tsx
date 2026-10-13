import { CareersView, careersMetadata } from '@/views/CareersView'
export const generateMetadata = () => careersMetadata('en')
export default function Page() { return <CareersView locale="en" /> }
