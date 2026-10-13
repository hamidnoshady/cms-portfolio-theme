import { CatchAllView, catchAllMetadata } from '@/views/CatchAllView'

type Params = Promise<{ slug?: string[] }>

export const generateMetadata = async ({ params }: { params: Params }) => {
  const { slug = [] } = await params
  return catchAllMetadata('en', slug)
}

export default async function Page({ params }: { params: Params }) {
  const { slug = [] } = await params
  return <CatchAllView locale="en" segments={slug} />
}
