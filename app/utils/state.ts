import { atom } from "jotai";

export const colorState = atom<Pixel>({ r: 0, g: 0, b: 0, a: 1 });

export const selectedToolState = atom<Tools>("Draw");
