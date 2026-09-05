// functions/_middleware.js
import { connect } from '@tidbcloud/serverless';

export async function getDb(env) {
  const connUrl = env.TIDB_DATABASE_URL || env.DATABASE_URL;
  if (!connUrl) {
    // Return a mock / memory fallback if no TiDB URL configured yet
    return null;
  }
  return connect({ url: connUrl });
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'dhani-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

export async function getUserFromSession(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionToken = cookies['session_token'] || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!sessionToken) return null;

  try {
    const [payloadBase64, signature] = sessionToken.split('.');
    if (!payloadBase64 || !signature) return null;
    
    // Verify signature
    const secret = env.JWT_SECRET || 'dhani-laundry-secure-jwt-secret-key-2026';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadBase64));
    
    if (!valid) return null;
    
    const payloadStr = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const user = JSON.parse(payloadStr);
    
    if (user.exp && user.exp < Date.now() / 1000) return null;
    return user;
  } catch (e) {
    return null;
  }
}

export async function createSessionToken(user, env) {
  const secret = env.JWT_SECRET || 'dhani-laundry-secure-jwt-secret-key-2026';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = {
    id: user.id,
    user_id: user.id,
    user_name: user.full_name || user.name,
    user_role: user.role || 'Customer',
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  };

  const payloadBase64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${payloadBase64}.${signature}`;
}
