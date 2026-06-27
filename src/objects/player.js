import { Player } from "textalive-app-api";

let player = null;

export function getPlayer() {
  if (player === null) {
    player = new Player({ app: { token: "QdNW4hGqnKRyZX8I" } });
  }
  return player;
}