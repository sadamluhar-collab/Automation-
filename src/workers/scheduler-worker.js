import {runScheduler} from '../scheduler/scheduler.js';
console.log('Automation scheduler started');
runScheduler().catch(error=>{console.error('scheduler stopped',error);process.exit(1)});
