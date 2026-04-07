import axios from 'axios'
import client from './client.js'

export async function signup(email, password) {
  const { data } = await client.post('/auth/signup', { email, password })
  return data
}

export async function login(email, password) {
  const { data } = await client.post('/auth/login', { email, password })
  return data
}

export async function verifyEmail(token) {
  const { data } = await axios.get(
    `${client.defaults.baseURL}/auth/verify-email`,
    { params: { token } },
  )
  return data
}

export async function resendVerification(email) {
  const { data } = await axios.post(
    `${client.defaults.baseURL}/auth/resend-verification`,
    { email },
  )
  return data
}

export async function forgotPassword(email) {
  const { data } = await axios.post(
    `${client.defaults.baseURL}/auth/forgot-password`,
    { email },
  )
  return data
}

export async function resetPassword(token, password) {
  const { data } = await axios.post(
    `${client.defaults.baseURL}/auth/reset-password`,
    { token, password },
  )
  return data
}

export async function refresh(token) {
  const { data } = await client.post('/auth/refresh', { refreshToken: token })
  return data
}
