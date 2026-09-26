import { nextTick } from 'vue'

let resolveInitialBoardRead: () => void
export const initialBoardRead = new Promise<void>(resolve => { resolveInitialBoardRead = resolve })
let initialSetsRead: Promise<void> | undefined
let collecting = true

export function registerInitialSetsRead(read: Promise<void>) {
  if (collecting) initialSetsRead = read
}

export async function finishInitialBoardRead() {
  collecting = false
  await initialSetsRead
  await nextTick()
  resolveInitialBoardRead()
}
