const TARGETS = [
  'https://www.google.com/generate_204',
  'https://example.com/'
];

export async function internetStatus({timeoutMs=5000}={}) {
  let lastError;
  for (const url of TARGETS) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {'user-agent': 'AutomationPlatform/1.0', accept: '*/*'},
        signal: controller.signal,
        redirect: 'follow'
      });
      const latencyMs = Date.now() - started;
      if (response.ok || response.status === 204) {
        return {
          success: true,
          status: 'live',
          latency_ms: latencyMs,
          checked_url: url,
          http_status: response.status,
          checked_at: new Date().toISOString()
        };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.name === 'AbortError' ? 'timeout' : error?.message || 'request failed';
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    success: false,
    status: 'offline',
    latency_ms: null,
    checked_url: null,
    http_status: null,
    checked_at: new Date().toISOString(),
    error: lastError || 'internet probe failed'
  };
}
