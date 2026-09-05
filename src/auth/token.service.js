import {encrypt,decrypt} from '../security/encryption.js';

export const protectToken=encrypt;
export const revealToken=decrypt;

export function protectYouTubeCredential(credential={}){
  return {
    access_token:credential.access_token?encrypt(credential.access_token):null,
    refresh_token:credential.refresh_token?encrypt(credential.refresh_token):null,
    expires_at:credential.expires_at||null,
    scope:credential.scope||null,
    token_type:credential.token_type||'Bearer'
  };
}

export function revealYouTubeCredential(credential={}){
  return {
    ...credential,
    access_token:credential.access_token?decrypt(credential.access_token):null,
    refresh_token:credential.refresh_token?decrypt(credential.refresh_token):null
  };
}
