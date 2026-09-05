import {youtubeRequest} from './youtube.api.js';
import {loadYouTubeCredential} from '../../auth/youtube-credential.service.js';

export async function syncChannel(token){return youtubeRequest(token,'channels?part=snippet,statistics,brandingSettings,contentDetails&mine=true')}

export async function syncStoredChannel(channelId,userId){
  const {channel,accessToken}=await loadYouTubeCredential(channelId,userId);
  const data=await youtubeRequest(accessToken,`channels?part=snippet,statistics,brandingSettings,contentDetails&id=${encodeURIComponent(channel.youtube_channel_id)}`);
  return {channel,accessToken,data};
}
