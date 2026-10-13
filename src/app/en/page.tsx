import { HomeView, homeMetadata } from '@/views/HomeView'
export const generateMetadata = () => homeMetadata('en')
export default function Page() { return <HomeView locale="en" /> }
