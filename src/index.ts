#!/usr/bin/env node

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {CallToolRequestSchema, ListToolsRequestSchema, Tool} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import sharp from "sharp";
import * as dotenv from 'dotenv';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { SSERedisTransport } from './redis_transport'

dotenv.config();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const API_BASE = process.env.OPENAI_API_BASE || "https://api.openai.com/v1/images/generations";


interface DalleResponse {
    // Response structure from Dalle API
    created: number;
    data?: Array<{
      url: string;
    }>;
  }

class DallEClient {
  // Core client properties
  private server: Server;
  private axiosInstance;
  private baseURLs = {
    generate_image: API_BASE,
  };

  constructor() {
    this.server = new Server(
      {
        name: "dalle-mcp-sse",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      }
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Define available tools: tavily-search and tavily-extract
      const tools: Tool[] = [
        {
          name: "generate_image",
          description: "Generate an image given a prompt by openai dall-e-3 model.",
          inputSchema: {
            type: "object",
            properties: {
                prompt: { 
                type: "string", 
                description: "The prompt to generate an image from" 
              },
            },
            required: ["prompt"]
          }
        },
      ];
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        let response: DalleResponse;
        const args = request.params.arguments ?? {};

        switch (request.params.name) {
          case "generate_image":
            response = await this.search({
              prompt: args.prompt,
            });
            break;

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }

        const origin_url = `${response.data?.[0].url}`
        if (!origin_url) {
          throw new Error("No image found");
        }
        
        // Process image
        // 压缩图片size，因为claude无法处理大图片（建议小于1M）
        const {url, base64} = await this.processImage(origin_url);
        
        return {
          content: [{
            type: "text",
            text: url
          },{
            type: 'image',
            mimeType: 'image/webp',
            data: base64
          }]
        };
      } catch (error: any) {
        if (axios.isAxiosError(error)) {
          return {
            content: [{
              type: "text",
              text: `Dalle API error: ${error.response?.data?.message ?? error.message}`
            }],
            isError: true,
          }
        }
        throw error;
      }
    }); 
  }

  async run(): Promise<void> {
    const app = express();
    app.use(express.json());
    
    app.get("/sse", async (req: any, res: any) => {
      console.log("Received connection");
      const transport = new SSERedisTransport("/messages", res, REDIS_URL as string);
      // console.log("Connecting transport", transport);
      await this.server.connect(transport);
    });
    
    app.post("/messages", async (req: any, res: any) => {
      console.log("Received message");
      const sessionId = req.query.sessionId;
      console.log("Session ID", sessionId);
      const transport = new SSERedisTransport("/messages", sessionId, REDIS_URL as string);
      // console.log("Connecting transport", transport);
      await this.server.connect(transport);

      let body = req.body
      if (body.method === "tools/call") {
        console.log("Received call request", body);
      }

      await transport.handlePostMessage(req, res);
      res.end()
    });
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  }

  async search(params: any): Promise<DalleResponse> {
    try {
      // Choose endpoint based on whether it's an extract request
      const endpoint = this.baseURLs.generate_image;
      
      // Add topic: "news" if query contains the word "news"
      const searchParams = {
        ...params,
        model: 'dall-e-3',
        n: 1,
        size: "1024x1024"
      };
      console.log("Start generate...")
      
      const response = await this.axiosInstance.post(endpoint, searchParams);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid API key');
      } else if (error.response?.status === 429) {
        throw new Error('Usage limit exceeded');
      }
      throw error;
    }
  }

  async processImage(url: string): Promise<{ url: string; base64: string }> {
    try {
      console.log(`Get image from ${url}`)
      // 下载图片
      const response = await axios.get(url, { responseType: "arraybuffer" });
      let buffer = Buffer.from(response.data);
  
      // 设定初始质量和目标大小
      let quality = 80; // 初始 WebP 质量
      let outputBuffer: Buffer;
  
      do {
        outputBuffer = await sharp(buffer)
          .webp({ quality })
          .toBuffer();
  
        quality -= 5; // 逐步降低质量，减少大小
      } while (outputBuffer.length > 5 * 1024 && quality > 10);
  
      // 转换为 Base64
      const base64 = outputBuffer.toString("base64");
      console.log("Process image success.")

      return {
        url,
        base64: `${base64}`,
      };
    } catch (error: any) {
      throw new Error("Process image failed: " + error.message);
    }
  }
}

export async function serve(): Promise<void> {
  const client = new DallEClient();
  await client.run();
}

const server = new DallEClient();
server.run().catch(console.error);
