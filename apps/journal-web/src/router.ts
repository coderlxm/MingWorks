import { createRouter, createWebHistory } from 'vue-router';
import { normalizePublicSearchQuery } from './components/discovery/discoveryRoutes';
import NotFoundView from './components/NotFoundView.vue';
import FeedView from './components/journal/FeedView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'public', component: FeedView },
    { path: '/about', name: 'about', component: () => import('./components/about/AboutView.vue') },
    {
      path: '/resume',
      name: 'resume',
      component: () => import('./components/resume/ResumeView.vue'),
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('./components/discovery/PublicSearchView.vue'),
      props: route => ({
        query: typeof route.query.q === 'string'
          ? normalizePublicSearchQuery(route.query.q)
          : '',
      }),
    },
    {
      path: '/archive',
      name: 'archive',
      component: () => import('./components/discovery/PublicArchiveView.vue'),
    },
    {
      path: '/archive/:year(\\d{4})/:month(0[1-9]|1[0-2])',
      name: 'archive-month',
      component: () => import('./components/discovery/PublicArchiveMonthView.vue'),
      props: true,
    },
    {
      path: '/photos',
      name: 'photos',
      component: () => import('./components/photos/PhotoLibraryView.vue'),
    },
    {
      path: '/photos/:albumId',
      name: 'photo-album',
      component: () => import('./components/photos/PhotoAlbumView.vue'),
      props: true,
    },
    {
      path: '/games',
      name: 'games',
      component: () => import('./components/games/GameLibraryView.vue'),
    },
    {
      path: '/ai',
      name: 'ai',
      component: () => import('./components/ai/AiView.vue'),
    },
    {
      path: '/guestbook',
      name: 'guestbook',
      component: () => import('./components/guestbook/GuestbookView.vue'),
    },
    {
      path: '/me',
      name: 'private',
      component: () => import('./components/journal/private-feed/PrivateAssetFeedView.vue'),
    },
    {
      path: '/me/settings',
      name: 'settings',
      component: () => import('./components/settings/SiteProfileSettingsView.vue'),
    },
    {
      path: '/me/contributions',
      name: 'contribution-inbox',
      component: () => import('./components/contribution/AdminContributionInboxView.vue'),
    },
    {
      path: '/me/contributions/:publicId',
      name: 'contribution-review',
      component: () => import('./components/contribution/AdminContributionReviewView.vue'),
      props: true,
    },
    {
      path: '/me/entries/new',
      name: 'entry-new',
      component: () => import('./components/publisher/EntryPublisherView.vue'),
    },
    {
      path: '/me/entries/:entryId(\\d+)/edit',
      name: 'entry-edit',
      component: () => import('./components/publisher/EntryPublisherView.vue'),
      props: route => ({ entryId: Number(route.params.entryId) }),
    },
    {
      path: '/me/articles/new',
      name: 'article-new',
      component: () => import('./components/article/ArticleEditorView.vue'),
    },
    {
      path: '/me/articles/:articleId(\\d+)/edit',
      name: 'article-edit',
      component: () => import('./components/article/ArticleEditorView.vue'),
      props: route => ({ articleId: Number(route.params.articleId) }),
    },
    { path: '/p/:publicId', name: 'detail', component: FeedView },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
});

const routeTitles = new Map([
  ['about', '关于我 · 小明同学'],
  ['resume', '个人简历 · 小明同学'],
  ['photos', '照片墙 · 小明同学'],
  ['photo-album', '照片墙 · 小明同学'],
  ['games', '游戏墙 · 小明同学'],
  ['ai', 'AI · 小明同学'],
  ['guestbook', '留言板 · 小明同学'],
]);

router.afterEach((to) => {
  document.title = routeTitles.get(String(to.name)) ?? '小明同学';
});
