import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const url = new URL(request.nextUrl.pathname, process.env.NODE_ENV === 'development'
      ? 'http://127.0.0.1:8000'
      : process.env.API_URL || 'https://ai-safety-debate-production.up.railway.app'
    );
    
    // Add custom headers for streaming endpoints
    const headers = new Headers();
    if (request.nextUrl.pathname.includes('/stream')) {
      headers.set('Cache-Control', 'no-cache, no-transform');
      headers.set('Connection', 'keep-alive');
      headers.set('X-Accel-Buffering', 'no');
      headers.set('Content-Type', 'text/event-stream');
    }
    
    return NextResponse.rewrite(url, {
      headers: headers,
    });
  }

  return NextResponse.next();
}