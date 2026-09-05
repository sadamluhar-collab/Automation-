import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';

const API_BASE=process.env.AUTOMATION_MCP_API_BASE||`http://127.0.0.1:${process.env.PORT||10000}`;
const MCP_SECRET=process.env.AUTOMATION_MCP_SECRET;
if(!MCP_SECRET) throw new Error('Missing AUTOMATION_MCP_SECRET');

async function api(path,method='GET',body){
  const r=await fetch(`${API_BASE}${path}`,{method,headers:{'content-type':'application/json','x-mcp-secret':MCP_SECRET},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={raw:text}};
  if(!r.ok) throw new Error(data?.error?.message||`Automation API ${r.status}`);
  return data;
}

export function createAutomationMcp(){
 const server=new McpServer({name:'youtube-automation',version:'1.0.0'});
 server.tool('start_pipeline',{project_id:z.string(),count:z.number().int().min(1).max(50).default(1)},async({project_id,count})=>({content:[{type:'text',text:JSON.stringify(await api('/api/mcp/start','POST',{project_id,count}))}]}));
 server.tool('get_status',{job_id:z.string().optional(),pipeline_run_id:z.string().optional()},async(args)=>({content:[{type:'text',text:JSON.stringify(await api('/api/mcp/status','POST',args))}]}));
 server.tool('retry_job',{job_id:z.string()},async({job_id})=>({content:[{type:'text',text:JSON.stringify(await api('/api/mcp/retry','POST',{job_id}))}]}));
 server.tool('schedule_video',{job_id:z.string(),publish_at:z.string()},async(args)=>({content:[{type:'text',text:JSON.stringify(await api('/api/mcp/schedule','POST',args))}]}));
 server.tool('youtube_analytics',{channel_id:z.string().optional()},async(args)=>({content:[{type:'text',text:JSON.stringify(await api('/api/mcp/analytics','POST',args))}]}));
 return server;
}

export async function handleMcp(req,res){
 if(req.headers['x-mcp-secret']!==MCP_SECRET)return res.writeHead(401).end('Unauthorized');
 const server=createAutomationMcp();
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:()=>randomUUID()});
 await server.connect(transport);return transport.handleRequest(req,res,req.body);
}
