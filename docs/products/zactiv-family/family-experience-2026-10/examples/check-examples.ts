import assert from 'node:assert/strict'
import { chooseIdea, eligibleIdeas, participatingDays, type FamilyIdea, type MomentContext } from './choose-idea'
const base: FamilyIdea = { id: 'a', published: true, minutes: 5, setting: 'indoors', kit: 'none', kind: 'move', hasSeatedVersion: true, editorialPriority: 1 }
const context: MomentContext = { minutes: 5, setting: 'indoors', availableKit: ['none'], seatedRequired: true, kind: 'move', recentIdeaIds: [] }
const ideas: FamilyIdea[] = [base,{...base,id:'b',editorialPriority:2},{...base,id:'long',minutes:10},{...base,id:'outside',setting:'outdoors'},{...base,id:'objects',kit:'objects'},{...base,id:'no-seated',hasSeatedVersion:false},{...base,id:'draft',published:false},{...base,id:'chat',kind:'chat'},{...base,id:'invalid-duration',minutes:NaN}]
assert.deepEqual(eligibleIdeas(ideas,context).map(i=>i.id),['b','a'])
assert.equal(chooseIdea(ideas,context)?.id,'b')
assert.equal(chooseIdea(ideas,{...context,recentIdeaIds:['b']})?.id,'a')
assert.equal(chooseIdea(ideas,context,2)?.id,'b')
assert.equal(chooseIdea(ideas,context,NaN)?.id,'b')
assert.equal(chooseIdea(ideas,{...context,minutes:1}),null)
assert.equal(chooseIdea([] ,context),null)
assert.equal(participatingDays([
  {operationId:'1',householdLocalDate:'2026-09-28'},
  {operationId:'1',householdLocalDate:'2026-09-28'},
  {operationId:'2',householdLocalDate:'2026-09-28'},
  {operationId:'3',householdLocalDate:'2026-10-04'},
  {operationId:'4',householdLocalDate:'2026-10-05'},
  {operationId:'5',householdLocalDate:'2026-09-27'},
],'2026-09-28','2026-10-05'),2)
console.log('8 meaningful example assertions passed: hard constraints, ordering, finite rotation, empty sets, invalid rotation and weekly unique-date aggregation.')
