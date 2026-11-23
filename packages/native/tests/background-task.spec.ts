import { beforeEach, describe, expect, it, vi } from 'vitest'

const plugin = vi.hoisted(() => ({
  native: true,
  finished: [] as string[],
  // Runs the callback straight away, before the id comes back, as iOS can.
  beforeExit: async (callback: () => Promise<void>) => {
    void callback()
    await new Promise(resolve => setTimeout(resolve, 5))
    return 'task-1'
  },
}))

vi.mock('../src/platform', () => ({ isNativePlatform: () => plugin.native }))
vi.mock('@capawesome/capacitor-background-task', () => ({
  BackgroundTask: {
    beforeExit: (callback: () => Promise<void>) => plugin.beforeExit(callback),
    finish: ({ taskId }: { taskId: string }) => plugin.finished.push(taskId),
  },
}))

const { finishInBackground } = await import('../src/background-task')

describe('finishInBackground', () => {
  beforeEach(() => {
    plugin.native = true
    plugin.finished = []
  })

  it('tells the OS the task is over even when it finishes before the task id arrives', async () => {
    await finishInBackground(async () => {})
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(plugin.finished).toEqual(['task-1'])
  })

  it('still finishes when the task throws', async () => {
    await finishInBackground(async () => {
      throw new Error('offline')
    })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(plugin.finished).toEqual(['task-1'])
  })

  it('just runs the task on the web', async () => {
    plugin.native = false
    const task = vi.fn(async () => {})
    await finishInBackground(task)
    expect(task).toHaveBeenCalledOnce()
    expect(plugin.finished).toEqual([])
  })
})
