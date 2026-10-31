import { runLocalVideoDownload } from './services/video-download/videoDownloadRunner.js';
import {
  readVideoDownloadRequest,
  writeVideoDownloadEvent,
} from './services/video-download/videoDownloadProtocol.js';

const request = await readVideoDownloadRequest();
const result = await runLocalVideoDownload({
  url: request.url,
  ytDlpPath: '/opt/homebrew/bin/yt-dlp',
  rclonePath: '/opt/homebrew/bin/rclone',
  rcloneRemote: 'personal-gdrive',
  workRoot: '/tmp/notinews-downloads',
  nodePath: '/Users/xiaomingli/.local/share/fnm/aliases/default/bin/node',
  onStage(stage) {
    writeVideoDownloadEvent({ type: 'stage', stage });
  },
});
writeVideoDownloadEvent(result);
