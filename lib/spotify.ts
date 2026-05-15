import { supabase } from './supabase'

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'

export async function exchangeSpotifyCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  })
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Spotify token exchange failed (${res.status}): ${text}`)
  }
  const json = await res.json()
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  }
}

export async function fetchTopArtists(accessToken: string): Promise<string[]> {
  const res = await fetch(
    'https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=20',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) throw new Error(`Spotify top artists failed (${res.status})`)
  const json = await res.json()
  return (json.items ?? []).map((a: { name: string }) => a.name)
}

export async function saveSpotifyData(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  artists: string[],
) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  await supabase.from('users').update({
    spotify_access_token: accessToken,
    spotify_refresh_token: refreshToken,
    spotify_token_expires_at: expiresAt,
    spotify_top_artists: artists,
    spotify_interest: true,
  }).eq('id', userId)
}

export async function refreshSpotifyToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  })
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Spotify token refresh failed (${res.status})`)
  const json = await res.json()
  return { accessToken: json.access_token, expiresIn: json.expires_in }
}
