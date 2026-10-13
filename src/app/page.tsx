import { HomeView, homeMetadata } from '@/views/HomeView'

export const generateMetadata = () => homeMetadata('fa')

export default function Page() {
  return <HomeView locale="fa" />
}
