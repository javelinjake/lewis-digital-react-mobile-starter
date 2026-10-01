import type Player from 'video.js/dist/types/player'
import { isNativePlatform } from '@ld/native'
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '@/lib/assets'
import { mimeTypeFromUrl } from '@/lib/video-source'
import 'video.js/dist/video-js.css'
import '@videojs/themes/dist/city/index.css'

interface VideoPlayerProps {
  src: string
  poster?: string
  mimeType?: string
  aspectRatio: string
  portrait: boolean
  onPlay?: () => void
  onEnded?: () => void
}

function playsInSystemPlayer() {
  return isNativePlatform() || import.meta.env.VITE_BUILD_TARGET === 'native'
}

function SystemVideoPlayer({
  src,
  poster,
  mimeType,
  aspectRatio: initialAspectRatio,
  portrait,
  onPlay,
  onEnded,
}: VideoPlayerProps) {
  const fallbackAspect = portrait ? '9 / 16' : '16 / 9'
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio || fallbackAspect)

  function presentSystemPlayer(video: HTMLVideoElement) {
    const player = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
      webkitDisplayingFullscreen?: boolean
    }
    if (player.webkitDisplayingFullscreen)
      return

    try {
      if (typeof player.webkitEnterFullscreen === 'function') {
        player.webkitEnterFullscreen()
        return
      }
      if (document.fullscreenElement == null)
        void video.requestFullscreen().catch(() => {})
    }
    catch {
      // Inline system controls remain if fullscreen is refused.
    }
  }

  return (
    <div
      className="zactiv-video-player relative mb-6 w-full max-w-full rounded-3xl bg-black"
      style={{ aspectRatio }}
    >
      <video
        className="zactiv-system-video"
        poster={poster ? assetUrl(poster, { size: 'large' }) : undefined}
        controls
        playsInline={false}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (video.videoWidth > 0 && video.videoHeight > 0)
            setAspectRatio(`${video.videoWidth} / ${video.videoHeight}`)
        }}
        onPlay={(event) => {
          onPlay?.()
          presentSystemPlayer(event.currentTarget)
        }}
        onEnded={() => onEnded?.()}
      >
        <source src={src} type={mimeType || 'video/mp4'} />
      </video>
    </div>
  )
}

function WebVideoPlayer({
  src,
  poster,
  mimeType,
  aspectRatio: initialAspectRatio,
  portrait,
  onPlay,
  onEnded,
}: VideoPlayerProps) {
  const node = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Player | null>(null)
  const fallbackAspect = portrait ? '9 / 16' : '16 / 9'
  const [frame, setFrame] = useState<{ src: string, ratio: string } | null>(null)
  const aspectRatio = (frame?.src === src ? frame.ratio : null) || initialAspectRatio || fallbackAspect

  useEffect(() => {
    playerRef.current?.trigger('resize')
  }, [aspectRatio])

  useEffect(() => {
    if (!node.current || !src)
      return

    let cancelled = false

    void import('video.js').then(({ default: videojs }) => {
      if (cancelled || !node.current)
        return

      const type = mimeType || mimeTypeFromUrl(src) || 'video/mp4'
      const player = videojs(node.current, {
        controls: true,
        preload: 'metadata',
        fill: true,
        fluid: false,
        responsive: false,
        playsinline: true,
        poster: poster ? assetUrl(poster, { size: 'large' }) : undefined,
        sources: [{ src, type }],
        controlBar: {
          pictureInPictureToggle: true,
          fullscreenToggle: true,
        },
      })

      playerRef.current = player

      player.on('play', () => onPlay?.())
      player.on('ended', () => onEnded?.())
      const syncFrame = () => {
        const width = player.videoWidth()
        const height = player.videoHeight()
        if (width > 0 && height > 0) {
          setFrame({ src, ratio: `${width} / ${height}` })
          player.trigger('resize')
        }
      }

      player.on('loadedmetadata', syncFrame)
    })

    return () => {
      cancelled = true
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [mimeType, onEnded, onPlay, poster, src])

  return (
    <div
      className="zactiv-video-player relative mb-6 w-full max-w-full rounded-3xl bg-black"
      style={{ aspectRatio }}
    >
      <video ref={node} className="video-js vjs-theme-city vjs-fill" playsInline />
    </div>
  )
}

export function VideoPlayer(props: VideoPlayerProps) {
  if (playsInSystemPlayer())
    return <SystemVideoPlayer {...props} />

  return <WebVideoPlayer {...props} />
}
