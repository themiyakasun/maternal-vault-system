import type { Patient, MeshNode } from '../types/triage';

export const mockPatients: Patient[] = [];

export const mockMeshNodes: MeshNode[] = [
  {
    id: 'node-1',
    name: 'Midwife Tablet 2 (Sunita)',
    role: 'Mobile Field Unit',
    channelInfo: 'Channel BLE-03 • RSSI -62',
    syncTime: 'Synced 2m ago',
    statusType: 'synced-recent',
    dotColor: 'green',
    isPulsing: true
  },
  {
    id: 'node-2',
    name: 'Clinic Base Gateway',
    role: 'Local Sub-center Server',
    channelInfo: 'Local Sub-center Server',
    syncTime: 'Synced 1m ago',
    statusType: 'synced',
    dotColor: 'green',
    isPulsing: false
  },
  {
    id: 'node-3',
    name: 'Ambulance Unit 04',
    role: 'Mobile Node',
    channelInfo: 'Mobile Node • Peer nearby (~180m)',
    syncTime: 'Direct Mesh',
    statusType: 'direct-mesh',
    dotColor: 'blue',
    isPulsing: false
  }
];
