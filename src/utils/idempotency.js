export function idempotencyKey(...parts){const a=Array.isArray(parts[0])&&parts.length===1?parts[0]:parts;return a.map(v=>String(v)).join(':')}
