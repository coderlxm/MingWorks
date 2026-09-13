import { ref, shallowRef } from 'vue';
import { fetchPublicFeed } from '../api/entries';
import type { JournalEntry, PublicJournalFeedItem } from '../types';

const STORAGE_KEY = 'journal_stories_last_viewed';

function isPublicJournalEntry(item: PublicJournalFeedItem): item is JournalEntry {
  return item.visibility === 'public';
}

export function useProfileStories() {
  const stories = shallowRef<JournalEntry[]>([]);
  const isViewerOpen = ref(false);
  const hasUnviewed = ref(false);
  const loading = ref(false);
  const loadError = shallowRef<string | null>(null);

  function checkUnviewed(entries: JournalEntry[]): void {
    if (entries.length === 0) {
      hasUnviewed.value = false;
      return;
    }
    const latestTime = entries[0].sourceCreatedAt || entries[0].capturedAt;
    const lastViewed = localStorage.getItem(STORAGE_KEY);
    if (!lastViewed) {
      hasUnviewed.value = true;
      return;
    }
    hasUnviewed.value = new Date(latestTime).getTime() > new Date(lastViewed).getTime();
  }

  async function loadStories(): Promise<void> {
    loading.value = true;
    loadError.value = null;
    try {
      const feed = await fetchPublicFeed({ channel: 'life' });
      const publicEntries = feed.entries.filter(isPublicJournalEntry).slice(0, 6);
      stories.value = publicEntries;
      checkUnviewed(publicEntries);
    }
    catch (reason) {
      loadError.value = reason instanceof Error ? reason.message : String(reason);
      throw reason;
    }
    finally {
      loading.value = false;
    }
  }

  function openStories(): boolean {
    if (stories.value.length === 0) return false;
    isViewerOpen.value = true;
    return true;
  }

  function closeStories(): void {
    isViewerOpen.value = false;
  }

  function markAllViewed(): void {
    if (stories.value.length === 0) return;
    const latestTime = stories.value[0].sourceCreatedAt || stories.value[0].capturedAt;
    localStorage.setItem(STORAGE_KEY, latestTime);
    hasUnviewed.value = false;
  }

  return {
    stories,
    isViewerOpen,
    hasUnviewed,
    loading,
    loadError,
    loadStories,
    openStories,
    closeStories,
    markAllViewed,
  };
}
