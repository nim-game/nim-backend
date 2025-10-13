export type BoxState = boolean[][];
export type ServerMessage = { type: 'state'; boxes: BoxState };
export type ClientMessage = { type: 'remove'; indexRow: number; indexLine: number } | { type: 'reset' };