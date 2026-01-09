import { NextRequest, NextResponse } from 'next/server';

/**
 * API Proxy - 转发请求到外部 API 以绕过 CORS 限制
 * 
 * POST /api/proxy
 * Body: { url: string, method: string, headers: object, body?: object }
 */
export async function POST(request: NextRequest) {
    try {
        const { url, method, headers, body } = await request.json();

        if (!url) {
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            );
        }

        const fetchOptions: RequestInit = {
            method: method || 'GET',
            headers: headers || {},
        };

        if (body && method !== 'GET') {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: `Proxy failed: ${error}` },
            { status: 500 }
        );
    }
}
