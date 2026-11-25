import { useState } from 'react'
import { analyticsAvailable, setAnalyticsConsent, telemetry } from '@/lib/telemetry/telemetry'

/** Asks once whether anonymous usage can be recorded. Nothing is recorded until the player says yes. */
export function ConsentCard() {
  const [decided, setDecided] = useState(() => telemetry.consent.decided)
  if (decided || !analyticsAvailable)
    return null
  const choose = (analytics: boolean) => {
    setDecided(true)
    void setAnalyticsConsent(analytics)
  }
  return (
    <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Help improve Pixel Pitch">
      <span>Help improve Pixel Pitch? We would like to record how the game is played (which screens, which features). Nothing that identifies you, and you can change your mind in Settings.</span>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary min-h-11" onClick={() => choose(true)}>Yes, happy to</button>
        <button type="button" className="btn btn-ghost min-h-11" onClick={() => choose(false)}>No thanks</button>
      </div>
    </section>
  )
}
