import { useParams } from 'react-router'
import { RichText } from '@/components/rich-text'
import { usePageQuery } from '@/lib/use-content'

export function CmsScreen() {
  const { slug = '' } = useParams()
  const query = usePageQuery(slug)
  const page = query.data

  return (
    <main className="screen screen-stack">
      {query.isPending ? <p>Loading…</p> : null}
      {!query.isPending && !page ? <p>That page could not be found.</p> : null}
      {page
        ? (
            <>
              <h1 className="mb-4 text-4xl font-bold">{page.title || page.slug}</h1>
              <RichText html={page.content} />
            </>
          )
        : null}
    </main>
  )
}
