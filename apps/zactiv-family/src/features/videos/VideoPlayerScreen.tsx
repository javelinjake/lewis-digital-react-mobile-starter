import { useCallback, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ContentBody } from '@/components/rich-text'
import { Icon } from '@/components/ui'
import { VideoPlayer } from '@/features/videos/VideoPlayer'
import { ensureActivityLog, finishItemActivity, validateStoredLog } from '@/lib/activity-log'
import { assetUrl } from '@/lib/assets'
import { useVideoQuery, useVideosQuery } from '@/lib/use-content'
import { useFamilyState } from '@/lib/use-family-state'
import { refreshBalance } from '@/lib/zactivs'
import { useAuthStore } from '@/stores/auth.store'

export function VideoPlayerScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const query = useVideoQuery(id)
  const list = useVideosQuery()
  const { state } = useFamilyState()
  const userId = useAuthStore(state => state.user?.id)
  const loggedPlay = useRef(false)
  const video = query.data
  const next = list.data?.find(item => item.id !== video?.id)
  const src = video ? assetUrl(video.file, { size: 'original' }) : ''

  useEffect(() => {
    loggedPlay.current = false
  }, [video?.id])

  useEffect(() => {
    if (!video?.id)
      return
    void validateStoredLog('video', video.id)
  }, [video?.id])

  const handlePlay = useCallback(() => {
    if (!userId || !video || loggedPlay.current)
      return

    loggedPlay.current = true
    void ensureActivityLog(userId, 'video', video.id)
  }, [userId, video])

  const handleEnded = useCallback(() => {
    if (!video)
      return

    void finishItemActivity('video', video.id).then(async (ok) => {
      if (!ok)
        return
      if (video.zactivs)
        await refreshBalance(video.zactivs)
      else
        await refreshBalance()
      navigate(`/videos/${video.id}/complete`)
    })
  }, [navigate, video])

  if (!video)
    return <main className="screen"><p>{query.isPending ? 'Loading video…' : 'That video could not be found.'}</p></main>

  if (!src)
    return <main className="screen"><p>This video file is not available yet.</p></main>

  return (
    <main className="screen screen-stack">
      <VideoPlayer
        src={src}
        poster={video.image}
        mimeType={video.mimeType}
        aspectRatio={video.aspectRatio}
        portrait={video.portrait}
        onPlay={handlePlay}
        onEnded={handleEnded}
      />
      <h1 className="mb-4 text-3xl font-bold">{video.name}</h1>
      <ContentBody value={video.description} className="mb-6" />
      {state.preferences.captions ? <p className="mb-4 text-sm opacity-70">Captions are on when your device provides them for this file.</p> : null}
      {next
        ? (
            <Link to={`/videos/${next.id}`} className="flex items-center gap-3 rounded-3xl bg-brand-card p-4">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Up next</span>
                <span className="block font-bold">{next.name}</span>
              </span>
              <Icon name="caret-right" />
            </Link>
          )
        : null}
    </main>
  )
}
