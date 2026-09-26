import path from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { ZodError } from 'zod';
import { JournalAiSuggestionService } from './aiSuggestionService.js';
import { JournalArticleService } from './articles/articleService.js';
import { JournalAuth } from './auth.js';
import { JournalContributionError } from './contributions/contributionError.js';
import { JournalContributionLinkService } from './contributions/contributionLinkService.js';
import { JournalContributionMediaService } from './contributions/contributionMedia.js';
import { JournalContributionNotificationService } from './contributions/contributionNotification.js';
import { JournalContributionService } from './contributions/contributionService.js';
import { openJournalDatabase } from './data/database.js';
import { JournalDeletionService } from './entries/deletion.js';
import { GameRepository } from './games/gameRepository.js';
import { GameService } from './games/gameService.js';
import { GuestbookRepository } from './guestbook/guestbookRepository.js';
import { GuestbookService } from './guestbook/guestbookService.js';
import { JournalGuestbookNotificationService } from './guestbook/guestbookNotification.js';
import { JournalIngestService } from './telegram/ingest.js';
import { JournalCommentNotificationService } from './interactions/interactionNotification.js';
import { JournalInteractionService } from './interactions/interactionService.js';
import { JournalKnowledgeAgentService } from './knowledge/knowledgeAgentService.js';
import { JournalKnowledgeRepository } from './knowledge/knowledgeRepository.js';
import { JournalPhotoDriveClient } from './photos/photoDriveClient.js';
import { JournalPhotoLibraryService } from './photos/photoLibraryService.js';
import {
  JournalImagePreviewBackfillService,
  JournalImagePreviewService,
} from './media/imagePreview.js';
import { JournalRepository } from './data/repository.js';
import {
  JournalResumePreviewBackfillService,
  JournalResumePreviewService,
} from './resume/resumePreview.js';
import { JournalResumeService } from './resume/resumeService.js';
import { registerArticleRoutes } from './routes/articles.js';
import { registerAutomationArticleRoutes } from './routes/automationArticles.js';
import { registerContributionRoutes } from './routes/contributions.js';
import { registerFeedRoutes } from './routes/feeds.js';
import { registerGameRoutes } from './routes/games.js';
import { registerGuestbookRoutes } from './routes/guestbook.js';
import { registerInternalRoutes } from './routes/internal.js';
import { registerInteractionRoutes } from './routes/interactions.js';
import { registerKnowledgeRoutes } from './routes/knowledge.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerPhotoRoutes } from './routes/photos.js';
import { registerPrivateContributionRoutes } from './routes/privateContributions.js';
import { registerPrivateEntryRoutes } from './routes/privateEntries.js';
import { registerPublicDiscoveryRoutes } from './routes/publicDiscovery.js';
import { registerPublicFeedRoutes } from './routes/publicFeed.js';
import { registerResumeRoutes } from './routes/resume.js';
import { registerSiteProfileRoutes } from './routes/siteProfile.js';
import { registerTagSuggestionRoutes } from './routes/tagSuggestions.js';
import { registerTopicSuggestionRoutes } from './routes/topicSuggestions.js';
import { registerWeatherRoutes } from './routes/weather.js';
import { JournalSiteProfileService } from './siteProfileService.js';
import { JournalStorage } from './media/storage.js';
import { TelegramFileDownloader } from './telegram/telegramFiles.js';
import type { JournalServerConfig } from './types.js';
import { JournalVideoNormalizationService } from './media/videoNormalization.js';
import {
  JournalVideoPreviewBackfillService,
  JournalVideoPreviewService,
} from './media/videoPreview.js';
import { JournalWebEntryService } from './entries/webEntryService.js';
import { JournalWebEntryUploadService } from './entries/webEntryUploadService.js';
import { JournalWeatherService } from './weatherService.js';

export async function createJournalServer(config: JournalServerConfig): Promise<FastifyInstance> {
  const server = Fastify({ logger: true });
  const database = openJournalDatabase(config.dataDir);
  const repository = new JournalRepository(database);
  const gameRepository = new GameRepository(database);
  const auth = new JournalAuth(config.ingestToken, config.articleToken, config.adminPassword);
  const resumePreviews = new JournalResumePreviewService();
  const resumeService = new JournalResumeService(
    repository,
    auth,
    config.publicBaseUrl,
    resumePreviews,
  );
  const siteProfileService = new JournalSiteProfileService(repository, resumeService);
  const weatherService = new JournalWeatherService(
    config.qweatherApiKey,
    config.qweatherCityId,
  );
  const aiSuggestions = new JournalAiSuggestionService(config.deepseekApiKey);
  const photoLibrary = new JournalPhotoLibraryService(
    new JournalPhotoDriveClient({
      clientId: config.photoDriveClientId,
      clientSecret: config.photoDriveClientSecret,
      refreshToken: config.photoDriveRefreshToken,
    }),
    config.photoDriveRootFolderId,
  );
  const storage = new JournalStorage(config.dataDir);
  await storage.initializeContributionStorage();
  const previews = new JournalImagePreviewService();
  const videoPreviews = new JournalVideoPreviewService();
  const videoNormalization = new JournalVideoNormalizationService(storage, videoPreviews);
  const articleService = new JournalArticleService(repository, storage, previews);
  const knowledgeRepository = new JournalKnowledgeRepository(database);
  const knowledgeAgentService = new JournalKnowledgeAgentService(
    knowledgeRepository,
    articleService,
    config.publicBaseUrl,
    config.deepseekApiKey,
  );
  const webEntryService = new JournalWebEntryService(repository, storage);
  const gameService = new GameService(gameRepository, storage);
  const webEntryUploads = new JournalWebEntryUploadService(
    repository,
    storage,
    previews,
    videoNormalization,
  );
  const deletionService = new JournalDeletionService(repository, storage);
  const downloader = new TelegramFileDownloader(config.telegramToken);
  const contributionLinks = new JournalContributionLinkService(
    repository,
    config.publicBaseUrl,
  );
  const contributionService = new JournalContributionService(
    repository,
    storage,
    new JournalContributionMediaService(storage, videoNormalization),
  );
  const contributionNotifications = new JournalContributionNotificationService(
    config.telegramToken,
    config.allowedChatId,
    config.publicBaseUrl,
  );
  const ingestService = new JournalIngestService(
    config.allowedChatId,
    repository,
    storage,
    downloader,
    previews,
    videoPreviews,
  );
  const commentNotifications = new JournalCommentNotificationService(
    config.telegramToken,
    config.allowedChatId,
    config.publicBaseUrl,
  );
  const interactionService = new JournalInteractionService(repository, commentNotifications);
  const guestbookService = new GuestbookService(
    new GuestbookRepository(database),
    new JournalGuestbookNotificationService(
      config.telegramToken,
      config.allowedChatId,
      config.publicBaseUrl,
    ),
  );
  await new JournalImagePreviewBackfillService(repository, storage, previews).run();
  await new JournalVideoPreviewBackfillService(repository, storage, videoPreviews).run();
  await new JournalResumePreviewBackfillService(repository, resumePreviews).run();
  await siteProfileService.initialize(path.join(config.webRoot, 'avatar-ming.png'));

  await server.register(fastifyCookie, { secret: config.cookieSecret });
  await server.register(fastifyMultipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });
  await server.register(fastifyRateLimit, {
    global: false,
    max: 5,
    timeWindow: 60_000,
  });
  server.addContentTypeParser(
    'application/offset+octet-stream',
    (_request, _payload, done) => done(null),
  );
  await server.register(fastifyStatic, {
    root: config.webRoot,
    prefix: '/',
    wildcard: false,
    index: false,
  });

  server.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);
    if (error instanceof JournalContributionError) {
      await reply.code(error.statusCode).send(error.response());
      return;
    }
    const requestError = error as Error & { statusCode?: number };
    const statusCode = error instanceof ZodError
      ? 400
      : typeof requestError.statusCode === 'number'
        ? requestError.statusCode
        : 500;
    await reply.code(statusCode).send({ error: requestError.message });
  });

  server.get('/api/health', async () => {
    database.prepare('SELECT 1').get();
    return { status: 'ok' };
  });

  await registerInternalRoutes(server, { auth, deletionService, ingestService, repository });
  await registerInteractionRoutes(server, {
    auth,
    repository,
    service: interactionService,
    visitorSecret: config.cookieSecret,
  });
  await registerGuestbookRoutes(server, { auth, service: guestbookService });
  await registerContributionRoutes(server, {
    links: contributionLinks,
    contributions: contributionService,
    notifications: contributionNotifications,
    storage,
  });
  await registerPublicDiscoveryRoutes(server, auth, repository);
  await registerPublicFeedRoutes(server, auth, repository, config.cookieSecret);
  await registerPrivateEntryRoutes(
    server,
    auth,
    repository,
    deletionService,
    webEntryService,
    webEntryUploads,
  );
  await registerTagSuggestionRoutes(server, auth, aiSuggestions, siteProfileService);
  await registerTopicSuggestionRoutes(server, auth, aiSuggestions);
  webEntryUploads.registerRoutes(server);
  await registerArticleRoutes(server, auth, articleService);
  await registerAutomationArticleRoutes(server, auth, articleService, config.publicBaseUrl);
  await registerKnowledgeRoutes(server, auth, knowledgeAgentService);
  await registerMediaRoutes(server, auth, repository, config.dataDir);
  await registerPhotoRoutes(server, photoLibrary);
  await registerPrivateContributionRoutes(server, {
    auth,
    links: contributionLinks,
    contributions: contributionService,
    repository,
    dataDir: config.dataDir,
  });
  await registerSiteProfileRoutes(server, auth, siteProfileService);
  await registerResumeRoutes(server, { auth, resumeService });
  await registerWeatherRoutes(server, weatherService);
  await registerFeedRoutes(server, repository, siteProfileService, config.publicBaseUrl);
  await registerGameRoutes(server, {
    auth,
    repository: gameRepository,
    service: gameService,
    dataDir: config.dataDir,
  });

  const sendApplication = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-cache');
    return reply.sendFile('index.html');
  };
  server.get('/', sendApplication);

  server.get('/contribute', async (_request, reply) => {
    reply.header('Cache-Control', 'no-cache');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    return reply.sendFile('contribute.html');
  });

  server.setNotFoundHandler(async (request, reply) => {
    const pathname = new URL(request.url, config.publicBaseUrl).pathname;
    const isServerResource = pathname === '/api'
      || pathname.startsWith('/api/')
      || pathname === '/media'
      || pathname.startsWith('/media/')
      || path.extname(pathname) !== '';
    const isPageNavigation = (request.method === 'GET' || request.method === 'HEAD')
      && typeof request.headers.accept === 'string'
      && request.headers.accept.includes('text/html')
      && !isServerResource;
    if (isPageNavigation) {
      return sendApplication(request, reply);
    }
    return reply.code(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: 'Not Found',
      statusCode: 404,
    });
  });

  server.addHook('onClose', async () => {
    database.close();
  });

  return server;
}
