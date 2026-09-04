export function priority({deadline,scheduled=false,retry=false}={}){if(deadline)return 1;if(scheduled)return 2;if(retry)return 3;return 4}
