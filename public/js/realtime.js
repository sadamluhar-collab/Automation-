export function reconcile(fetchState,apply){return fetchState().then(state=>{apply(state);return state})}
