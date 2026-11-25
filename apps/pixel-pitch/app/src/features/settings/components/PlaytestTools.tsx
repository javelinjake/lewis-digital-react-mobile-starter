import { ListGroup, ListItem } from '@ld/mobile-ui'
import { ConfirmDialog, useToast } from '@ld/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

const HOUR = 60 * 60 * 1000

/**
 * Tools for trying the game out in a playtest build (offline, mock data): move the clock, start a new day, top up
 * the wallet, and start again. The shop itself works in this build with pretend purchases. They talk to the mock through `window`, so nothing here
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
      <ListGroup label="Playtest: time">
        <ListItem title="Game clock" subtitle={ahead > 0 ? `${ahead >= 48 ? `${Math.round(ahead / 24)} days` : `${ahead}h`} ahead of real time` : 'Real time'} />
        <ListItem title="Start the next day" subtitle="New goals, calendar day, free pack and gems" onClick={() => run(tools.nextDay, 'A new day')} />
        <ListItem title="Skip ahead 1 hour" subtitle="Shelf, tray and the stadium fill" onClick={() => skip(1, '1h')} />
        <ListItem title="Skip ahead 3 hours" subtitle="Plays the next league match" onClick={() => skip(3, '3h')} />
        <ListItem title="Skip ahead 8 hours" subtitle="A night away" onClick={() => skip(8, '8h')} />
        <ListItem title="Skip ahead 7 days" subtitle="A week of league and Pass progress" onClick={() => skip(24 * 7, '7 days')} />
      </ListGroup>

      <ListGroup label="Playtest: shop (pretend purchases)">
        <ListItem title="Open the shop" subtitle="Buy the Pass, gems, the Licence and the starter offer for nothing" onClick={() => navigate('/shop?from=playtest')} />
        <ListItem
          title="League Pass"
          subtitle={status.hasPass ? 'On for this season. Tap to turn off' : 'Off. Tap to turn on without the shop'}
          onClick={() => run(() => window.__pixelPitchClock?.setPass(!status.hasPass), status.hasPass ? 'League Pass off' : 'League Pass on')}
        />
      </ListGroup>

      <ListGroup label="Playtest: top up">
        <ListItem title="Refill arcade energy" subtitle="Back to full" onClick={() => run(tools.refillEnergy, 'Energy refilled')} />
        <ListItem title="Coins" subtitle="+10,000 coins" onClick={() => run(() => tools.grant({ coins: 10_000 }), '+10,000 coins')} />
        <ListItem title="Tokens" subtitle="+300 tokens (one Arcade pack)" onClick={() => run(() => tools.grant({ tokens: 300 }), '+300 tokens')} />
        <ListItem title="Packs" subtitle="+5 packs on the shelf" onClick={() => run(() => tools.grant({ packs: 5 }), '+5 packs')} />
        <ListItem title="Star pack" subtitle="+1 Star pack" onClick={() => run(() => tools.grant({ starPacks: 1 }), '+1 Star pack')} />
        <ListItem title="Finish today's goals" subtitle="Ready to claim" onClick={() => run(tools.finishGoals, 'Goals finished')} />
        <ListItem title="Pass XP" subtitle="+500 XP (5 tiers)" onClick={() => run(() => tools.addPassXp(500), '+500 Pass XP')} />
      </ListGroup>

      <ListGroup label="Playtest: start again">
        <ListItem title="Reset the club" subtitle="Deletes it and puts the clock back to real time" onClick={() => setResetOpen(true)} />
      </ListGroup>
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
