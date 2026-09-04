import {encrypt,decrypt} from '../security/encryption.js';export const protectToken=encrypt;export const revealToken=decrypt;
