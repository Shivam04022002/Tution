import { request } from './client';
import type { AuthUser } from '../types';

/**
 * Admin authentication rides on the platform's existing credential login —
 * `POST /api/auth/login` with `emailOrMobile` + `password`. There is no
 * separate admin login endpoint and none is added.
 */

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  role: string;
  user: AuthUser;
}

export function login(emailOrMobile: string, password: string) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { emailOrMobile, password },
    anonymous: true,
  });
}

/**
 * Restores the session on reload and is the authority on the current role —
 * the console never trusts a locally cached role for access decisions.
 * Returns the user at the top level (not inside `data`).
 */
export function getCurrentUser() {
  return request<{ success: boolean; user: AuthUser }>('/auth/me');
}

export function logout() {
  return request<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

/**
 * `PUT /api/auth/profile` whitelists dotted paths (`profile.firstName`, ...) and
 * `$set`s them verbatim, so the body must use that exact key shape.
 */
export function updateProfile(payload: {
  'profile.firstName'?: string;
  'profile.lastName'?: string;
  'profile.profileImage'?: string;
}) {
  return request<{ success: boolean; message: string; user: AuthUser }>('/auth/profile', {
    method: 'PUT',
    body: payload,
  });
}
