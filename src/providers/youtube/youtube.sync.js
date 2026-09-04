import {youtubeRequest} from './youtube.api.js';export async function syncChannel(token){return youtubeRequest(token,'channels?part=snippet,statistics,brandingSettings&mine=true')}
