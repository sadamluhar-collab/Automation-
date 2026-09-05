import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const API=process.env.AUTOMATION_API_URL||'https://automation-api-m16m.onrender.com';
const SECRET=process.env.WORKER_SECRET;
const WORKER_ID=process.env.BROWSER_WORKER_ID||`pc-browser-${randomUUID().slice(0,8)}`;
if(!SECRET) throw new Error('WORKER_SECRET is required');

const child=spawn(process.platform==='win32'?'npx.cmd':'npx',['-y','chrome-devtools-mcp@latest','--browser-url=http://127.0.0.1:9222'],{stdio:['pipe','pipe','inherit'],windowsHide:true});
let nextId=1;const pending=new Map();let buffer='';
child.stdout.setEncoding('utf8');
child.stdout.on('data',chunk=>{buffer+=chunk;for(;;){const nl=buffer.indexOf('\n');if(nl<0)break;const line=buffer.slice(0,nl).trim();buffer=buffer.slice(nl+1);if(!line.startsWith('{'))continue;try{const msg=JSON.parse(line);if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message||'MCP error')):p.resolve(msg.result)}}catch{}}});
child.on('exit',(code)=>{for(const p of pending.values())p.reject(new Error(`MCP process exited (${code})`));process.exit(code||0)});
function rpc(method,params={}){const id=nextId++;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')})}
async function init(){await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'automation-pc-browser-bridge',version:'1.0.0'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized',params:{}})+'\n')}
async function api(path,options={}){const r=await fetch(`${API}${path}`,{...options,headers:{'content-type':'application/json','x-worker-secret':SECRET,...(options.headers||{})}});const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||`API ${r.status}`);return data}
async function main(){await init();console.log(`PC browser bridge online: ${WORKER_ID}`);for(;;){try{const claimed=await api('/api/browser/commands/claim',{method:'POST',body:JSON.stringify({worker_id:WORKER_ID})});const cmd=claimed?.data;if(!cmd){await new Promise(r=>setTimeout(r,1500));continue}try{if(cmd.command==='mcp_call'){const result=await rpc('tools/call',{name:cmd.args?.tool,arguments:cmd.args?.arguments||{}});await api(`/api/browser/commands/${cmd.id}/complete`,{method:'POST',body:JSON.stringify({status:'completed',result})})}else if(cmd.command==='mcp_list_tools'){const result=await rpc('tools/list',{});await api(`/api/browser/commands/${cmd.id}/complete`,{method:'POST',body:JSON.stringify({status:'completed',result})})}else{throw new Error(`Unsupported browser command: ${cmd.command}`)}}catch(error){await api(`/api/browser/commands/${cmd.id}/complete`,{method:'POST',body:JSON.stringify({status:'failed',error_message:error.message})}).catch(()=>{})}}}}
main().catch(error=>{console.error(error);child.kill();process.exit(1)});
