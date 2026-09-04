import {executeCommand} from './command-executor.js';
export const commandCenter={execute:(command,jobId,userId)=>executeCommand(command,jobId,userId)};
