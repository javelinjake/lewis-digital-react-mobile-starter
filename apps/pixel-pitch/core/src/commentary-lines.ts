// The words of the written match report. Everything is written for 5-a-side: a small pitch, no offside, kick-ins
// instead of throw-ins, a keeper who rushes out and rolls it to start moves, quick free kicks and constant pressing.
// A chance is a TYPE (a curler, a rebound, a smothering save...) with a few lead-ins and a few finishes that all fit
// it, so any lead-in can meet any finish of its type and the report is rarely the same twice. Presentation only: the
// goals, saves and misses themselves come from the match, so the report always agrees with the result.
// `{p}` is the player on the ball, `{q}` a team-mate, `{gk}` the keeper defending, `{own}` the attacking side's own
// keeper, `{d}` an opposing outfield player, `{team}` the side attacking and `{opp}` the side defending.

export interface Play {
  setup: readonly string[]
  outcome: readonly string[]
}

export type GoalType = 'tapIn' | 'curler' | 'toePoke' | 'volley' | 'solo' | 'rebound' | 'deflection' | 'freeKick' | 'penalty' | 'keeperError' | 'longShot' | 'chip' | 'backHeel' | 'corner'

export const GOAL_OPENERS_FOR = ['GOAL!', 'Goal!', 'It\'s in!', 'Back of the net!', 'That\'s in!', 'Yes!', 'Scored!']
export const GOAL_OPENERS_AGAINST = ['Goal for {team}.', 'They\'ve scored.', '{team} score.', 'That\'s in at the other end.', 'Ouch. Conceded.', '{team} have it.']

export const GOALS: Record<GoalType, Play> = {
  tapIn: {
    setup: [
      '{q} wins it high up and drives at the {opp} defence.',
      '{q} gets to the byline and looks up.',
      '{team} are swarming forward, with {q} on the ball out wide.',
    ],
    outcome: [
      '{q} cuts it back and {p} taps in from a yard.',
      '{q} squares it across the face of goal, and {p} cannot miss.',
      '{p} gets ahead of {d} and pokes {q}\'s pass over the line.',
    ],
  },
  curler: {
    setup: [
      '{p} picks up the ball on the edge of the area.',
      '{p} takes it on the turn, with a yard of space.',
      '{d} backs off and {p} sizes up the shot.',
    ],
    outcome: [
      '{p} bends it round {gk} into the far corner.',
      '{p} curls it in off the inside of the post.',
      '{gk} dives, but it is arcing away from them. In the top corner.',
    ],
  },
  toePoke: {
    setup: [
      'A scramble in the area, the ball bobbling loose.',
      '{gk} makes a mess of a bouncing ball.',
      'A deflected shot drops in the area, and everybody is waiting for it.',
    ],
    outcome: [
      '{p} gets a toe to it and it dribbles over the line.',
      '{p} stabs it in from close range. Ugly, but it counts.',
      '{p} gets there first and pokes it past a stranded {gk}.',
    ],
  },
  volley: {
    setup: [
      '{q} sends in a looping cross.',
      'The ball drops invitingly at the edge of the area.',
      'A long ball forward is knocked down by {q}.',
    ],
    outcome: [
      '{p} meets it on the volley and it flies past {gk}.',
      '{p} swings a boot, and the half-volley is unstoppable.',
      '{p} hits it first time. Into the roof of the net.',
    ],
  },
  solo: {
    setup: [
      '{p} gets the ball in their own half and sets off.',
      '{p} takes it off {d} and drives forward.',
      'A loose pass, and {p} is in on the break.',
    ],
    outcome: [
      '{p} goes past {d}, then {gk}, and rolls it into the empty net.',
      '{p} beats two players and slots it home.',
      '{p} shows real pace, rounds the keeper and finishes.',
    ],
  },
  rebound: {
    setup: [
      '{p} lets fly and {gk} gets a hand to it.',
      '{q} shoots from distance and {gk} parries.',
      '{gk} saves the first one but cannot hold on.',
    ],
    outcome: [
      '{p} is first to the rebound and puts it away.',
      'The loose ball sits up for {p}, who finishes at the second attempt.',
      'It falls to {p}, and the follow-up is calm.',
    ],
  },
  deflection: {
    setup: [
      '{p} tries their luck from distance.',
      '{q} slides it to {p} on the edge of the area.',
      'A shot comes in from {p}, heading just wide.',
    ],
    outcome: [
      'It takes a wicked deflection off {d} and loops over {gk}.',
      '{d} sticks out a leg, and it spins into the corner.',
      'A huge deflection! {gk} is wrong-footed.',
    ],
  },
  freeKick: {
    setup: [
      'The referee gives {team} a free kick close to the area.',
      '{d} clips {q}, and it is a free kick in a dangerous spot.',
      'A foul by {d}. {p} stands over the ball.',
    ],
    outcome: [
      '{p} curls it over the wall and in.',
      '{p} takes it quickly and catches {gk} out at the near post.',
      '{p} drills it low through the wall. {gk} is beaten.',
    ],
  },
  penalty: {
    setup: [
      '{d} brings down {q} in the area. Penalty!',
      'Handball by {d}! The referee points to the mark.',
      '{q} is bundled over in the box. Penalty to {team}.',
    ],
    outcome: [
      '{p} sends {gk} the wrong way and rolls it in.',
      '{p} blasts it down the middle. No chance.',
      '{p} steps up and sweeps it into the bottom corner.',
    ],
  },
  keeperError: {
    setup: [
      '{q} tries a speculative shot from halfway.',
      'A loose pass back towards {gk}, and {p} is lurking.',
      '{p} chases down a long clearance.',
    ],
    outcome: [
      '{gk} fumbles it, and {p} gleefully tucks it in.',
      '{gk} lets it squirm under their body. {p} says thank you.',
      '{gk} misjudges the bounce, and {p} pounces for an easy finish.',
    ],
  },
  longShot: {
    setup: [
      '{p} spots {gk} off their line.',
      '{p} gets space in the middle, with no one closing down.',
      'There is nobody near {p} on halfway.',
    ],
    outcome: [
      '{p} lets fly from distance, and it dips under the bar.',
      '{p} hits it from nowhere and {gk} is beaten.',
      'A thunderbolt from {p}. {gk} had no chance.',
    ],
  },
  chip: {
    setup: [
      '{gk} races out to close down {p}.',
      '{p} is through, one on one.',
      '{q} slips {p} in behind the defence.',
    ],
    outcome: [
      '{p} waits, waits, then lifts it over the stranded {gk}.',
      'A cheeky chip from {p} sails over {gk} and drops in.',
      '{p} dinks it over the keeper with the coolest of touches.',
    ],
  },
  backHeel: {
    setup: [
      '{q} plays it into a crowd in the area.',
      'A scramble at the near post, with the ball bouncing about.',
      'A short corner is worked to {q}.',
    ],
    outcome: [
      '{p} back-heels it past {gk}. Outrageous.',
      '{p} flicks it with the heel and it creeps in.',
      '{p} improvises a backheel, and {gk} is wrong-footed.',
    ],
  },
  corner: {
    setup: [
      'Corner to {team}. {q} takes it short to {p}.',
      'A corner for {team}, with {q} swinging it in.',
      '{team} have a corner, and {q} plays it back to {p} on the edge.',
    ],
    outcome: [
      '{p} lashes it into the bottom corner from the edge of the area.',
      'The routine comes off. {p} turns it in at the near post.',
      'The ball ricochets through the crowd, and {p} bundles it over the line.',
    ],
  },
}

// A rare one that does not depend on who scored.
export const OWN_GOAL: Play = {
  setup: [
    '{q} whips a dangerous ball across the area.',
    '{p} drives at the defence and shoots.',
    'A low cross comes in from {q}.',
  ],
  outcome: [
    '{d} tries to clear it and puts it into their own net! An own goal.',
    '{d} gets a touch and only diverts it past {gk}. An own goal.',
    '{d} slides in, and it flies into their own net. Unlucky.',
  ],
}

/** What each kind of player tends to score. Weights, not rules. */
export const GOAL_WEIGHTS: Record<'FWD' | 'MID' | 'DEF', Partial<Record<GoalType, number>>> = {
  FWD: { tapIn: 3, curler: 2, toePoke: 2, volley: 2, solo: 2, rebound: 2, chip: 2, backHeel: 1, deflection: 1, penalty: 1, keeperError: 1, corner: 1 },
  MID: { curler: 3, longShot: 3, volley: 2, freeKick: 2, corner: 2, deflection: 2, tapIn: 1, solo: 1, rebound: 1, penalty: 1, keeperError: 1 },
  DEF: { longShot: 3, corner: 3, freeKick: 2, deflection: 2, volley: 2, penalty: 1, solo: 1, keeperError: 1 },
}

export type SaveType = 'dive' | 'fingertip' | 'double' | 'smother' | 'claim'

export const SAVES: Record<SaveType, Play> = {
  dive: {
    setup: ['{p} lines up a shot from the edge of the area.', '{p} cuts in from the left and shoots.', '{q} lays it off, and {p} hits it hard.'],
    outcome: ['{gk} dives full length and tips it round the post.', 'A brilliant save! {gk} pushes it away at full stretch.', '{gk} gets down low and turns it behind for a corner.'],
  },
  fingertip: {
    setup: ['{p} curls one towards the top corner.', '{p} gets the ball out of their feet and fires at the far post.', '{p} unleashes a rocket from distance.'],
    outcome: ['{gk} just gets a fingertip to it. Corner!', '{gk} claws it away at full stretch, just under the bar.', '{gk} tips it onto the post and it bounces clear.'],
  },
  double: {
    setup: ['{p} has a shot blocked, and the ball falls to {q}.', '{p} shoots from close range.', 'A flurry in the area, with shots coming from everywhere.'],
    outcome: ['{gk} saves once, then saves again from the rebound. Two great stops!', '{gk} gets down twice in two seconds to keep it out.', '{gk} blocks the first with their legs and smothers the second.'],
  },
  smother: {
    setup: ['{p} is clean through on goal.', '{q} lays it off for {p} in space.', '{p} nips in behind the defence.'],
    outcome: ['{gk} rushes out and smothers it at the feet of {p}.', '{gk} spreads themselves big and blocks it with the body.', '{gk} gets there first and gathers at {p}\'s feet.'],
  },
  claim: {
    setup: ['{q} swings a cross in from the left.', 'A high ball comes in towards {p}.', '{team} send a free kick into the box.'],
    outcome: ['{gk} rises and claims it above {p}.', '{gk} plucks it out of the air and rolls it out to restart.', '{gk} comes for it and holds on comfortably.'],
  },
}

export type MissType = 'wide' | 'over' | 'post' | 'bar' | 'blocked' | 'scuffed' | 'rounded'

export const MISSES: Record<MissType, Play> = {
  wide: {
    setup: ['{p} gets into a shooting position.', '{q} lays it off to {p}.', '{p} has a sight of goal.'],
    outcome: ['{p} drags it just wide of the far post.', '{p} sees the shot skid past the post.', 'Wide! {p} should have hit the target.'],
  },
  over: {
    setup: ['{p} has a clear sight of goal from distance.', '{q} drops the ball into the path of {p}.', '{p} meets a loose ball just inside the area.'],
    outcome: ['{p} blazes it over the bar.', 'Over the top! {p} gets underneath it.', 'Over from {p}. Too much power, not enough control.'],
  },
  post: {
    setup: ['{p} turns and shoots.', '{p} shoots from the edge of the area.', '{p} bends one towards the corner.'],
    outcome: ['Off the post! {p} cannot believe it.', 'It rattles the woodwork. {gk} was beaten.', '{p} clips the inside of the post and it spins out.'],
  },
  bar: {
    setup: ['{p} lets fly from range.', '{p} takes aim from just outside the area.', '{q} rolls it back to {p}, who shoots first time.'],
    outcome: ['The crossbar! {p} hits it so cleanly, and it bounces back down.', 'Off the bar! {gk} could only watch.', 'It cannons off the crossbar and away to safety.'],
  },
  blocked: {
    setup: ['{p} shapes to shoot.', '{p} gets the ball onto the left foot.', '{p} winds up for the shot.'],
    outcome: ['{d} gets in the way and blocks it.', '{d} throws a body in the way, and the shot is charged down.', '{d} slides in and gets a crucial block.'],
  },
  scuffed: {
    setup: ['{p} finds space in the area.', '{q} rolls it into the path of {p}.', 'The ball sits up nicely for {p}.'],
    outcome: ['{p} scuffs the shot and it dribbles wide.', '{p} slices it, and it rolls out for a kick-in.', '{p} mis-hits it completely. Not a clean contact.'],
  },
  rounded: {
    setup: ['{p} is through and goes round {gk}.', '{p} takes the ball past the onrushing {gk}.', '{p} has the keeper beaten and an open goal in sight.'],
    outcome: ['{p} rounds {gk}, but the angle is gone, and it rolls wide.', '{p} takes it past the keeper but puts it into the side netting.', '{p} somehow puts it wide of the empty goal.'],
  },
}

// Colour: no effect on the score. `{team}` is the side the moment is about.
export const INCIDENTS = [
  '{d} is sent to the sin bin for two minutes. {team} have the extra player.',
  'A quick kick-in from {q} catches {opp} off guard, but {p} cannot make it count.',
  '{p} goes down after a heavy challenge, needs a moment, and is up and running again.',
  '{own} rolls it out quickly and {team} are away on the counter, but it comes to nothing.',
  'A word from the referee for {d} after another late challenge.',
  '{team} make a tactical switch, with {q} pushing up to join {p} in attack.',
  'Both sides trade possession in the middle with no real chances. The intensity is high.',
  '{opp} press high and force a mistake, but {team} recover.',
  '{q} and {p} swap wings, and {opp} have to rethink their marking.',
  'The ball runs out for a kick-in. {team} take it short.',
]

export const KICKOFFS = [
  'We are underway! {team} against {opp}, five a side.',
  'The whistle goes and {team} get us started.',
  '{team} v {opp}: two halves of {half} minutes and no room to hide.',
  'Kick-off. A small pitch, a fast ball and five players each. Here we go.',
  '{opp} kick off and straight away it is a high tempo.',
]

export const HALF_TIMES = {
  leading: ['Half-time. {team} lead {score}, but it is far from over on a pitch this small.', 'The whistle goes for half-time with {team} ahead, {score}.'],
  trailing: ['Half-time, and {team} trail {score}. A word from the manager is needed.', 'Break in play. {team} are behind, {score}, and have {half} minutes to turn it around.'],
  level: ['Half-time: {score}. Nothing in it so far.', 'All square at the break, {score}. Both keepers have been busy.'],
  scoreless: ['Half-time, and it is goalless. Plenty of effort, not much end product.', 'Nil-nil at the break. Both defences are on top.'],
}

export const FULL_TIMES = {
  bigWin: ['Full time! {team} win {score}. A really dominant display.', 'It is all over, {team} {score}. Never in doubt.'],
  win: ['Full time. {team} take the win, {score}.', 'The final whistle goes and {team} have the three points, {score}.'],
  draw: ['Full time. It finishes {score}, and the points are shared.', 'The whistle goes. {score}, a fair result in the end.'],
  scorelessDraw: ['Full time, goalless ({score}). Two good defences, and the points are shared.', 'No goals, {score}. The keepers were the heroes and the points are shared.'],
  loss: ['Full time. {team} are beaten, {score}.', 'It is over. {score}, and {opp} take the points.'],
  bigLoss: ['Full time, and it is a heavy defeat: {score}. A day to forget.', 'The final whistle brings {team} some relief. {score} to {opp}.'],
}

