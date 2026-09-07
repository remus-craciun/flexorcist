import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

const source = require("../assets/sounds/rest-end.wav");

let player: ReturnType<typeof createAudioPlayer> | null = null;
let configured = false;

/** Two-tone cue when rest time runs out. Lives outside the rest screen so it keeps playing through navigation. */
export async function playRestEndChime() {
  try {
    if (!configured) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "duckOthers",
      });
      configured = true;
    }
    if (!player) {
      player = createAudioPlayer(source);
    }
    await player.seekTo(0);
    player.play();
  } catch {
    // The session should continue even if the device cannot play audio.
  }
}
