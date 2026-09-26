import { shallowReactive } from 'vue'

const locations = shallowReactive(new Map<string, string>())

export function rememberEventLocation(eventId: string, fullPath: string) {
  locations.set(eventId, fullPath)
}

export function eventLocation(eventId: number) {
  return locations.get(String(eventId)) ?? `/events/${eventId}`
}
