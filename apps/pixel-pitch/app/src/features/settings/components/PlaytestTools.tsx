import { ConfirmDialog, useToast } from '@ld/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SettingsGroup, SettingsRow } from './SettingsRows'

const HOUR = 60 * 60 * 1000

/**
 * Tools for trying the game out in a playtest build (offline, mock data): move the clock, start a new day, stand in
 * for shop purchases that do not exist yet, and start again. They talk to the mock through `window`, so nothing here
 * exists in a live build, where the server owns the clock and the wallet.
 */
export function PlaytestTools() {
  const tools = window.__pixelPitchPlaytest
  const client = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [status, setStatus] = useState(() => tools?.status())
  const [resetOpen, setResetOpen] = useState(false)
  if (!tools || !status)
    return null

  /** Runs a tool, then has every screen read the club again. */
  const run = (action: () => void, message: string) => {
    action()
    setStatus(tools.status())
    void client.invalidateQueries()
    toast.push(message, 'info')
  }
  const skip = (hours: number, label: string) => run(() => window.__pixelPitchClock?.advance(hours * HOUR), `Skipped ${label} ahead`)
  const ahead = Math.round(status.offsetMs / HOUR)

  return (
    <>
      <SettingsGroup label="Playtest: time">
        <SettingsRow title="Game clock" subtitle={ahead > 0 ? `${ahead >= 48 ? `${Math.round(ahead / 24)} days` : `${ahead}h`} ahead of real time` : 'Real time'} />
        <SettingsRow title="Start the next day" subtitle="New goals, calendar day, free pack and gems" onClick={() => run(tools.nextDay, 'A new day')} />
        <SettingsRow title="Skip ahead 1 hour" subtitle="Shelf, tray and the stadium fill" onClick={() => skip(1, '1h')} />
        <SettingsRow title="Skip ahead 3 hours" subtitle="Plays the next league match" onClick={() => skip(3, '3h')} />
        <SettingsRow title="Skip ahead 8 hours" subtitle="A night away" onClick={() => skip(8, '8h')} />
        <SettingsRow title="Skip ahead 7 days" subtitle="A week of league and Pass progress" onClick={() => skip(24 * 7, '7 days')} />
      </SettingsGroup>

      <SettingsGroup label="Playtest: shop (pretend purchases)">
        <SettingsRow
          title="League Pass"
          subtitle={status.hasPass ? 'On: premium track, 6 energy, bigger shelf. Tap to turn off' : 'Off. Tap to buy it'}
          onClick={() => run(() => window.__pixelPitchClock?.setPass(!status.hasPass), status.hasPass ? 'League Pass off' : 'League Pass on')}
        />
        <SettingsRow title="Gem pack" subtitle="+100 gems" onClick={() => run(() => tools.grant({ gems: 100 }), '+100 gems')} />
        <SettingsRow title="Big gem pack" subtitle="+500 gems" onClick={() => run(() => tools.grant({ gems: 500 }), '+500 gems')} />
        <SettingsRow title="Starter bundle" subtitle="3 Star packs, 5,000 coins and 100 gems" onClick={() => run(() => tools.grant({ starPacks: 3, coins: 5000, gems: 100 }), 'Starter bundle added')} />
      </SettingsGroup>

      <SettingsGroup label="Playtest: top up">
        <SettingsRow title="Refill arcade energy" subtitle="Back to full" onClick={() => run(tools.refillEnergy, 'Energy refilled')} />
        <SettingsRow title="Coins" subtitle="+10,000 coins" onClick={() => run(() => tools.grant({ coins: 10_000 }), '+10,000 coins')} />
        <SettingsRow title="Tokens" subtitle="+300 tokens (one Arcade pack)" onClick={() => run(() => tools.grant({ tokens: 300 }), '+300 tokens')} />
        <SettingsRow title="Packs" subtitle="+5 packs on the shelf" onClick={() => run(() => tools.grant({ packs: 5 }), '+5 packs')} />
        <SettingsRow title="Star pack" subtitle="+1 Star pack" onClick={() => run(() => tools.grant({ starPacks: 1 }), '+1 Star pack')} />
        <SettingsRow title="Finish today's goals" subtitle="Ready to claim" onClick={() => run(tools.finishGoals, 'Goals finished')} />
        <SettingsRow title="Pass XP" subtitle="+500 XP (5 tiers)" onClick={() => run(() => tools.addPassXp(500), '+500 Pass XP')} />
      </SettingsGroup>

      <SettingsGroup label="Playtest: start again">
        <SettingsRow title="Reset the club" subtitle="Deletes it and puts the clock back to real time" onClick={() => setResetOpen(true)} destructive />
      </SettingsGroup>
      <ConfirmDialog
        open={resetOpen}
        title="Reset the club?"
        body="Your playtest club is deleted and you start again at New club. This cannot be undone."
        confirmLabel="Reset"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          tools.reset()
          setResetOpen(false)
          client.clear()
          navigate('/')
        }}
      />
    </>
  )
}
