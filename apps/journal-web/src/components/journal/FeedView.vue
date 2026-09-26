<script setup lang="ts">
import type {
  JournalChannel,
  JournalEntry,
  JournalInteractionSummary,
  ProtectedJournalEntryPreview,
  PublicJournalFeedItem,
} from '../../types';
import PublicEntryDetailView from './public-detail/PublicEntryDetailView.vue';
import PublicFeedView from './public-feed/PublicFeedView.vue';

withDefaults(defineProps<{
  detailId?: string;
  initialTag?: string;
  channel?: JournalChannel;
  overlayEntryId?: number;
  overlayEntry?: JournalEntry;
  overlayProtectedEntry?: ProtectedJournalEntryPreview;
  revealedPublicEntries?: ReadonlyMap<string, JournalEntry>;
}>(), {
  detailId: undefined,
  initialTag: '',
  channel: 'life',
  overlayEntryId: undefined,
  overlayEntry: undefined,
  overlayProtectedEntry: undefined,
  revealedPublicEntries: undefined,
});

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: PublicJournalFeedItem];
  detailLoaded: [entry: JournalEntry];
  detailUnlocked: [entry: JournalEntry];
  interactionsChange: [publicId: string, summary: JournalInteractionSummary];
  closeOverlay: [];
  removeDeletedOverlay: [];
  returnToFeed: [];
}>();

function forwardInteractionsChange(
  publicId: string,
  summary: JournalInteractionSummary,
): void {
  emit('interactionsChange', publicId, summary);
}
</script>

<template>
  <PublicEntryDetailView
    v-if="detailId !== undefined"
    :detail-id="detailId as string"
    @detail-loaded="emit('detailLoaded', $event)"
    @detail-unlocked="emit('detailUnlocked', $event)"
    @interactions-change="forwardInteractionsChange"
    @return-to-feed="emit('returnToFeed')"
  />
  <PublicFeedView
    v-else
    :channel="channel"
    :initial-tag="initialTag"
    :overlay-entry-id="overlayEntryId"
    :overlay-entry="overlayEntry"
    :overlay-protected-entry="overlayProtectedEntry"
    :revealed-public-entries="revealedPublicEntries"
    @layout-ready="emit('layoutReady')"
    @open-entry="emit('openEntry', $event)"
    @close-overlay="emit('closeOverlay')"
    @remove-deleted-overlay="emit('removeDeletedOverlay')"
  />
</template>
