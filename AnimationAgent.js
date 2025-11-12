import * as THREE from 'three';

export class AnimationAgent {
    constructor(boneNames) {
        this.boneNames = boneNames;
    }

    async generateAnimation(prompt) {
        const systemPrompt = `
You are an AI animation assistant for Three.js. Your task is to generate animation keyframes based on a user's prompt and a list of available bone names from a 3D model.

You must respond with a JSON object that strictly follows this schema:
{
  "tracks": [
    {
      "boneName": "string (must be one of the provided bone names)",
      "trackType": "string (either 'quaternion' for rotation or 'position' for movement)",
      "times": "array of numbers (time in seconds, e.g., [0, 1, 2])",
      "values": "array of numbers (flattened vector components, 4 for quaternion [x,y,z,w], 3 for position [x,y,z])"
    }
  ]
}

- "boneName" MUST EXACTLY match one of the names from the provided list.
- For rotations, use 'quaternion'. Quaternions are [x, y, z, w]. A neutral rotation is [0, 0, 0, 1].
- For movements, use 'position'. Positions are relative to the bone's parent. Use small values.
- The 'times' array defines the keyframe timestamps in seconds. It must start at 0.
- The 'values' array must have a length of times.length * (4 for quaternion, 3 for position).
- To create a simple animation (e.g., a wave), you might have a start, middle, and end keyframe. For example, times: [0, 0.5, 1].
- For a wave, you might rotate a 'Hand' bone on one axis. For a nod, you might rotate the 'Head' bone on the x-axis.
- Keep animations short, around 1-2 seconds.
- If the prompt is impossible or unclear, return a JSON with an empty "tracks" array: {"tracks": []}.
`;

        const userPrompt = `
Available bone names: ${JSON.stringify(this.boneNames)}

User animation prompt: "${prompt}"

Generate the keyframe data.
`;

        try {
            const completion = await websim.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                json: true,
            });

            const result = JSON.parse(completion.content);
            console.log("AI Response:", result);

            if (!result || !result.tracks || result.tracks.length === 0) {
                console.warn("AI returned no valid tracks.");
                return null;
            }

            return this.createAnimationClip(result.tracks);

        } catch (error) {
            console.error("Error communicating with AI:", error);
            return null;
        }
    }

    createAnimationClip(tracksData) {
        const tracks = [];

        for (const trackData of tracksData) {
            if (!this.boneNames.includes(trackData.boneName)) {
                console.warn(`AI used a bone name not in the skeleton: ${trackData.boneName}. Skipping track.`);
                continue;
            }

            const times = new Float32Array(trackData.times);
            const values = new Float32Array(trackData.values);
            const trackName = `${trackData.boneName}.${trackData.trackType}`;

            if (trackData.trackType === 'quaternion' || trackData.trackType === 'position') {
                 const track = new THREE.VectorKeyframeTrack(trackName, times, values);
                 tracks.push(track);
            }
        }

        if (tracks.length === 0) return null;

        const duration = tracks.reduce((max, track) => Math.max(max, track.times[track.times.length - 1]), 0);
        return new THREE.AnimationClip('AI_Animation', duration, tracks);
    }
}