/**
 * API Middleware for Request/Response Validation and Error Handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiRequest, validateApiResponse } from './validation';

// ==================== ERROR TYPES ====================

export class ApiValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

export class ApiProcessingError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'ApiProcessingError';
  }
}

// ==================== REQUEST VALIDATION MIDDLEWARE ====================

/**
 * Validates incoming API requests with proper error handling
 */
export function withRequestValidation<T>(
  schema: z.ZodSchema<T>
) {
  return async function(request: NextRequest): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
    try {
      const body = await request.json();
      const result = validateApiRequest(schema, body);
      
      if (!result.success) {
        console.error('🚨 API Request Validation Failed:', {
          error: result.error,
          body,
          url: request.url,
          method: request.method,
          timestamp: new Date().toISOString()
        });
        
        return {
          error: NextResponse.json(
            { 
              error: 'Invalid request data',
              details: result.error,
              field: result.error.split(':')[0]
            },
            { status: 400 }
          )
        };
      }
      
      return { data: result.data };
    } catch (parseError) {
      console.error('🚨 API Request Parsing Failed:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      });
      
      return {
        error: NextResponse.json(
          { 
            error: 'Invalid JSON in request body',
            details: parseError instanceof Error ? parseError.message : 'Request body must be valid JSON'
          },
          { status: 400 }
        )
      };
    }
  };
}

/**
 * Validates outgoing API responses with proper error handling
 */
export function withResponseValidation<T>(
  schema: z.ZodSchema<T>,
  context: string = 'API response'
) {
  return function(data: unknown): T {
    try {
      return validateApiResponse(schema, data, context);
    } catch (error) {
      console.error(`🚨 ${context} Validation Failed:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
        timestamp: new Date().toISOString()
      });
      
      throw new ApiProcessingError(
        `Invalid ${context.toLowerCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  };
}

// ==================== COMPREHENSIVE ERROR HANDLER ====================

/**
 * Wraps API route handlers with comprehensive error handling
 */
export function withErrorHandling<T>(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async function(request: NextRequest): Promise<NextResponse> {
    try {
      return await handler(request);
    } catch (error) {
      console.error('🚨 API Route Error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent'),
        errorType: error?.constructor?.name || 'Unknown'
      });
      
      // Handle specific error types
      if (error instanceof ApiValidationError) {
        return NextResponse.json(
          { 
            error: 'Validation error',
            details: error.message,
            field: error.field
          },
          { status: 400 }
        );
      }
      
      if (error instanceof ApiProcessingError) {
        return NextResponse.json(
          { 
            error: 'Processing error',
            details: error.message
          },
          { status: error.statusCode }
        );
      }
      
      // Handle network/timeout errors
      if (error instanceof Error && (
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('fetch')
      )) {
        return NextResponse.json(
          { 
            error: 'External service error',
            details: 'Request to external service failed. Please try again.'
          },
          { status: 502 }
        );
      }
      
      // Generic error handler
      return NextResponse.json(
        { 
          error: 'Internal server error',
          details: process.env.NODE_ENV === 'development' 
            ? (error instanceof Error ? error.message : 'Unknown error')
            : 'An unexpected error occurred. Please try again.'
        },
        { status: 500 }
      );
    }
  };
}

// ==================== RATE LIMITING ====================

const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiting middleware
 */
export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 60 * 1000 // 1 minute
) {
  return function(request: NextRequest): { allowed: true } | { allowed: false; response: NextResponse } {
    const clientId = request.ip || request.headers.get('x-forwarded-for') || 'anonymous';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return { allowed: true };
    }
    
    if (clientData.count >= maxRequests) {
      return {
        allowed: false,
        response: NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            details: `Maximum ${maxRequests} requests per ${windowMs / 1000} seconds`
          },
          { status: 429 }
        )
      };
    }
    
    clientData.count++;
    return { allowed: true };
  };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Creates a standardized API response
 */
export function createApiResponse<T>(
  data: T,
  status: number = 200,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(data, { 
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...headers
    }
  });
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  details?: string,
  status: number = 400,
  field?: string
): NextResponse {
  return NextResponse.json({
    error,
    details,
    field,
    timestamp: new Date().toISOString()
  }, { status });
}

/**
 * Logs API performance metrics
 */
export function logApiMetrics(
  endpoint: string,
  method: string,
  duration: number,
  status: number,
  error?: string
) {
  console.log('📊 API Metrics:', {
    endpoint,
    method,
    duration: `${duration}ms`,
    status,
    error,
    timestamp: new Date().toISOString()
  });
}