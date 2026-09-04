export async function reconcile(fetchState,apply){const state=await fetchState();apply(state);return state}
