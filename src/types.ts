export type BoxState = boolean[];
export type ServerMessage = { type: 'state'; boxes: BoxState };
export type ClientMessage = { type: 'remove'; index: number } | { type: 'reset' };