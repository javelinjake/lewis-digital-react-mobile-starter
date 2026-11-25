import { BackgroundTask } from '@capawesome/capacitor-background-task'
import { isNativePlatform } from './platform'

/**
 * Asks the OS for a little time to finish `task` after the app goes to the background: about 30 seconds on iOS,
 * a few minutes at most on Android. Call it from a pause handler, for work that must not be cut off half way, such
 * as flushing the outbox. It is not a way to run work later or on a schedule: the OS gives no such guarantee to any
 * app. On the web the task simply runs. Never throws; the task's own errors are swallowed, so handle them inside.
 */
export async function finishInBackground(task: () => Promise<unknown>): Promise<void> {
  if (!isNativePlatform()) {
    await task().catch(() => undefined)
    return
  }
  try {
    // The callback can finish before the native call returns its id (an empty outbox flushes at once), so it waits
    // for the id instead of reading a variable that is not assigned yet.
    let resolveId!: (id: string) => void
    const id = new Promise<string>((resolve) => {
      resolveId = resolve
    })
    resolveId(await BackgroundTask.beforeExit(async () => {
      try {
        await task()
      }
      catch {
        // The task reports its own failures; the OS only needs to hear that it is over.
      }
      finally {
        BackgroundTask.finish({ taskId: await id })
      }
    }))
  }
  catch {
    await task().catch(() => undefined)
  }
}
