// Camera shots per room, from the skill `wideo-nieruchomosci-higgsfield`
// (model-independent rules: one camera move per clip, short prompt, keep the layout).
//
// Each shot pins the first and the last frame to crops of the real photo
// (zoom / offset, see ZoomCrop). The model only fills the motion in between,
// so the clip starts and ends on the real room and nothing can vanish.

const IN = { start: { zoom: 1.0 }, end: { zoom: 1.2 } };

const SHOTS = {
  salon: { ...IN, move: "Smooth continuous dolly-in shot: the camera glides slowly forward into the living room." },
  sypialnia: { ...IN, move: "Smooth continuous dolly-in shot: the camera glides slowly forward toward the bed at eye level." },
  pokoj: { ...IN, move: "Smooth continuous dolly-in shot: the camera glides slowly forward into the room." },
  przedpokoj: { ...IN, move: "Smooth continuous dolly-in shot: the camera glides slowly forward along the hallway." },
  lazienka: { start: { zoom: 1.0 }, end: { zoom: 1.12 }, move: "Smooth slow push-in shot: the camera moves gently forward into the bathroom." },
  kuchnia: {
    start: { zoom: 1.15, x: -0.9 },
    end: { zoom: 1.15, x: 0.9 },
    move: "Smooth continuous tracking shot: the camera slides slowly sideways along the kitchen.",
  },
  balkon: { start: { zoom: 1.2 }, end: { zoom: 1.0 }, move: "Smooth continuous dolly-out shot: the camera glides slowly backward to reveal the balcony and the view." },
};

/** Maps a Polish room name typed by the user to a room kind. */
export function roomKind(name = "") {
  const n = name.toLowerCase();
  if (/salon|dzienn|living/.test(n)) return "salon";
  if (/kuch|aneks/.test(n)) return "kuchnia";
  if (/sypial/.test(n)) return "sypialnia";
  if (/łazien|lazien|wc|toalet/.test(n)) return "lazienka";
  if (/balkon|taras|loggi/.test(n)) return "balkon";
  if (/przedpok|hol|korytarz/.test(n)) return "przedpokoj";
  return "pokoj";
}

export function shotFor(roomName) {
  const shot = SHOTS[roomKind(roomName)];
  return {
    start: shot.start,
    end: shot.end,
    prompt:
      `${shot.move} ` +
      "Real estate interior video. Every object in the room stays in place and keeps its shape: furniture, tables, walls, windows and decor. " +
      "Steady horizon, no shake, natural daylight, photorealistic, empty quiet interior.",
  };
}
