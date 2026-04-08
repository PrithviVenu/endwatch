import client from './client.js'

export async function getUrls() {
  const { data } = await client.get('/urls')
  return data
}

export async function addUrl(url) {
  const { data } = await client.post('/urls', url)
  return data
}

export async function deleteUrl(id) {
  await client.delete(`/urls/${id}`)
}

export async function triggerCheck() {
  const { data } = await client.post('/urls/check')
  return data
}

export async function triggerCheckForUrl(id) {
  const { data } = await client.post(`/urls/${id}/check`)
  return data
}

export async function getStats() {
  const { data } = await client.get('/urls/stats')
  return data
}

export async function getHistory(id, hours = 24) {
  const { data } = await client.get(`/urls/${id}/history`, {
    params: hours != null ? { hours } : {},
  })
  return data
}

export async function getSla(id) {
  const { data } = await client.get(`/urls/${id}/sla`)
  return data
}
