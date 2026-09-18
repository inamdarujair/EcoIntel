import {
  ApiErrorResponse,
  HealthResponse,
  ChatResponse,
  AnalyzeInput,
  AnalyzeResponse,
  ReasoningEvaluationResult,
  RecommendationsResponse,
  EnvironmentalContext,
  Conversation,
  Message,
} from '@/types';

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        let errorCode = 'HTTP_ERROR';

        try {
          const errorBody = (await response.json()) as ApiErrorResponse;
          if (errorBody?.error?.message) {
            errorMessage = errorBody.error.message;
            errorCode = errorBody.error.code || errorCode;
          }
        } catch {
          // If response is not JSON, use standard HTTP status
        }

        throw new ApiError(errorMessage, response.status, errorCode);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Network request failed';
      throw new ApiError(message, 0, 'NETWORK_ERROR');
    }
  }

  public get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Health check endpoint
   */
  public async checkHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/api/health');
  }

  /**
   * Conversational Chat endpoint (POST /api/chat)
   * Orchestrates extraction, context merge, reasoning, clarification, recommendations
   */
  public async sendChatMessage(params: {
    message: string;
    conversationId?: string;
  }): Promise<ChatResponse> {
    return this.post<ChatResponse>('/api/chat', params);
  }

  /**
   * Structured Input Analysis endpoint (POST /api/analyze)
   * Validates canonical environmental fields and updates context
   */
  public async submitStructuredAnalysis(
    data: AnalyzeInput
  ): Promise<AnalyzeResponse> {
    return this.post<AnalyzeResponse>('/api/analyze', data);
  }

  /**
   * Deterministic Reasoning Evaluation endpoint (POST /api/reasoning/evaluate)
   * Returns triggered pathways, condition details, and attached evidence
   */
  public async evaluateReasoning(params: {
    conversationId?: string;
    context?: EnvironmentalContext;
  }): Promise<ReasoningEvaluationResult> {
    return this.post<ReasoningEvaluationResult>('/api/reasoning/evaluate', params);
  }

  /**
   * Recommendation Generation endpoint (POST /api/recommendations/generate)
   * Generates or fetches structured recommendations backed by scientific evidence
   */
  public async generateRecommendations(params: {
    conversationId?: string;
    context?: EnvironmentalContext;
  }): Promise<RecommendationsResponse> {
    return this.post<RecommendationsResponse>(
      '/api/recommendations/generate',
      params
    );
  }

  /**
   * Conversation history retrieval (GET /api/conversations/:id)
   */
  public async getConversation(id: string): Promise<{
    conversation: Conversation;
    messages: Message[];
    linkedContextId: string | null;
  }> {
    return this.get<{
      conversation: Conversation;
      messages: Message[];
      linkedContextId: string | null;
    }>(`/api/conversations/${id}`);
  }

  /**
   * Context retrieval by conversation (GET /api/conversations/:id/context)
   */
  public async getConversationContext(
    id: string
  ): Promise<EnvironmentalContext> {
    return this.get<EnvironmentalContext>(`/api/conversations/${id}/context`);
  }

  /**
   * Semantic knowledge search endpoint
   */
  public async searchKnowledge<T = unknown>(params: {
    query: string;
    variables?: string[];
    topK?: number;
    threshold?: number;
  }): Promise<T> {
    return this.post<T>('/api/knowledge/search', params);
  }
}

export const api = new ApiClient(BACKEND_BASE_URL);
export default api;
