import {
  ChatCompletionCreateParams,
} from "openai/resources/index";

import { streamSse } from "@continuedev/fetch";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  Tool,
} from "../../../index.js";
import { renderChatMessage } from "../../../util/messageContent.js";
import { BaseLLM } from "../../index.js";
import {
  fromChatCompletionChunk,
  LlmApiRequestType,
  toChatBody,
} from "../../openaiTypeConverters.js";
import { OcaTokenManager } from "./util/ocaTokenManager.js";
import { createOcaHeaders, generateOpcRequestId } from "./util/utils.js";
import { DEFAULT_OCA_BASE_URL, DEFAULT_OCA_VERSION } from "./util/constants.js";

class Oca extends BaseLLM {
  constructor(options: LLMOptions) {
    super({
      ...options,
      capabilities: {
        uploadImage: false,
        tools: true
      }
    });
    this.uniqueId = options.uniqueId || "no-unique-id";
    this.apiVersion = options.apiVersion ?? DEFAULT_OCA_VERSION;
  }

  static providerName = "oca";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: DEFAULT_OCA_BASE_URL,
  };

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [
    "list",
    "streamChat",
  ];

  protected _convertModelName(model: string): string {
    return model;
  }

  private convertTool(tool: Tool): any {
    return {
      type: tool.type,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
      },
    };
  }

  protected extraBodyProperties(): Record<string, any> {
    return {};
  }

  protected getMaxStopWords(): number {
    return 4;
  }

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    const finalOptions = toChatBody(messages, options);

    finalOptions.stop = options.stop?.slice(0, this.getMaxStopWords());
    return finalOptions;
  }

  protected async _getHeaders() {
    const token = (await OcaTokenManager.getToken()).access_token;
    if (!token) {
      throw new Error(
        "Oracle Code Assist Access Token not found or expired. Please log in again",
      );
    }
    const ocaHeaders = await createOcaHeaders(token, this.uniqueId);
    return ocaHeaders;
  }

  protected async _complete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): Promise<string> {
    let completion = "";
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      signal,
      options,
    )) {
      completion += chunk.content;
    }

    return completion;
  }

  protected _getEndpoint(
    endpoint: "chat/completions" | "models",
  ) {
    if (!this.apiBase) {
      throw new Error(
        "No API base URL provided. Please set the 'apiBase' option in config.json",
      );
    }
    // Remove trailing slashes from base and leading/trailing slashes from endpoint
    const base = this.apiBase.replace(/\/+$/, "");
    const ep = endpoint.replace(/^\/+|\/+$/g, "");
    const version = this.apiVersion
      ? this.apiVersion.replace(/^\/+|\/+$/g, "")
      : "";

    // Build the path
    let urlStr = base;
    if (version) urlStr += `/${version}`;
    if (ep) urlStr += `/${ep}`;

    return new URL(urlStr);
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      signal,
      options,
    )) {
      yield renderChatMessage(chunk);
    }
  }

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    body.stop = body.stop?.slice(0, this.getMaxStopWords());
    return body;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {    
    const body = this._convertArgs(options, messages);
    const headers = await this._getHeaders()

    const response = await this.fetch(this._getEndpoint("chat/completions"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        ...body,
        ...this.extraBodyProperties(),
      }),
      signal,
    });

    // Handle non-streaming response
    if (body.stream === false) {
      if (response.status === 499) {
        return; // Aborted by user
      }
      const data = await response.json();
      yield data.choices[0].message;
      return;
    }

    for await (const value of streamSse(response)) {
      const chunk = fromChatCompletionChunk(value);
      if (chunk) {
        yield chunk;
      }
    }
  }


  async listModels(): Promise<string[]> {
    const headers = await this._getHeaders()
    const response = await this.fetch(this._getEndpoint("models"), {
      method: "GET",
      headers: headers,
    });

    const data = await response.json();
    return data.data.map((m: any) => m.id);
  }

}

export default Oca;
