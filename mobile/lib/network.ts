import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

function connected(state: NetInfoState) {
  // Local LAN servers often fail the captive-portal "internet reachable" check.
  return state.isConnected !== false;
}

export async function isOnline() {
  return connected(await NetInfo.fetch());
}

export function onBecameOnline(callback: () => void) {
  let wasOnline: boolean | null = null;
  return NetInfo.addEventListener((state) => {
    const online = connected(state);
    if (online && wasOnline === false) callback();
    wasOnline = online;
  });
}
