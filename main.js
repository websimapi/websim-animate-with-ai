import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class AnimationStudio {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.skeleton = null;
        this.bones = [];
        this.mixer = null;
        this.currentAction = null;
        this.clock = new THREE.Clock();

        this.init();
        this.setupEventListeners();
    }

    init() {
        const canvas = document.getElementById('viewport');

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            50,
            canvas.parentElement.clientWidth / canvas.parentElement.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 1.5, 3);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Controls
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 1, 0);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        // Grid
        const gridHelper = new THREE.GridHelper(10, 10, 0x333333, 0x222222);
        this.scene.add(gridHelper);

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        this.animate();
    }

    setupEventListeners() {
        document.getElementById('model-upload').addEventListener('change', (e) => this.loadModel(e));
        document.getElementById('animate-btn').addEventListener('click', () => this.generateAnimation());
        document.getElementById('play-btn').addEventListener('click', () => this.playAnimation());
        document.getElementById('pause-btn').addEventListener('click', () => this.pauseAnimation());
        document.getElementById('reset-btn').addEventListener('click', () => this.resetAnimation());
    }

    loadModel(event) {
        const file = event.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const loader = new GLTFLoader();

        this.showLoading(true);

        loader.load(url, (gltf) => {
            // Remove old model
            if (this.model) {
                this.scene.remove(this.model);
            }

            this.model = gltf.scene;
            this.scene.add(this.model);

            // Center model
            const box = new THREE.Box3().setFromObject(this.model);
            const center = box.getCenter(new THREE.Vector3());
            this.model.position.sub(center);

            // Extract skeleton
            this.extractSkeleton();

            // Setup mixer
            this.mixer = new THREE.AnimationMixer(this.model);

            this.showLoading(false);
            document.getElementById('skeleton-info').classList.remove('hidden');
            document.getElementById('animation-controls').classList.remove('hidden');

            URL.revokeObjectURL(url);
        }, undefined, (error) => {
            console.error('Error loading model:', error);
            this.showLoading(false);
        });
    }

    extractSkeleton() {
        this.bones = [];

        this.model.traverse((object) => {
            if (object.isBone) {
                this.bones.push(object);
            }
        });

        this.displaySkeletonInfo();
    }

    displaySkeletonInfo() {
        const boneList = document.getElementById('bone-list');
        boneList.innerHTML = '';

        if (this.bones.length === 0) {
            boneList.innerHTML = '<div class=\"bone-item\">No skeleton found</div>';
            return;
        }

        this.bones.forEach((bone, index) => {
            const item = document.createElement('div');
            item.className = 'bone-item';
            item.textContent = `${index}: ${bone.name}`;
            boneList.appendChild(item);
        });
    }

    async generateAnimation() {
        const prompt = document.getElementById('animation-prompt').value.trim();
        if (!prompt || this.bones.length === 0) return;

        this.showLoading(true);
        document.getElementById('agent-status').classList.remove('hidden');

        try {
            // Coordinator Agent - analyzes prompt and delegates
            this.logAgent('Coordinator', 'Analyzing animation request...');

            const coordinatorResponse = await websim.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are a coordinator agent for animation. Analyze the user's animation request and break it down into specific body parts and actions.
Available bones: ${this.bones.map(b => b.name).join(', ')}
Respond with JSON following this schema:
{
    actions: Array<{
        bodyPart: string,
        action: string,
        bones: string[]
    }>
}`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                json: true
            });

            const plan = JSON.parse(coordinatorResponse.content);
            this.logAgent('Coordinator', `Identified ${plan.actions.length} actions`);

            // Animation Agent - generates keyframes
            this.logAgent('Animation', 'Generating keyframes...');

            const animationResponse = await websim.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are an animation agent. Generate keyframe data for skeletal animation.
Return JSON with this schema:
{
    duration: number,
    keyframes: Array<{
        boneName: string,
        time: number,
        rotation: {x: number, y: number, z: number},
        position?: {x: number, y: number, z: number}
    }>
}
Rotations in radians. Duration in seconds.`
                    },
                    {
                        role: 'user',
                        content: `Create keyframes for: ${JSON.stringify(plan.actions)}`
                    }
                ],
                json: true
            });

            const animationData = JSON.parse(animationResponse.content);
            this.logAgent('Animation', `Generated ${animationData.keyframes.length} keyframes`);

            // Apply animation
            this.applyAnimation(animationData);

        } catch (error) {
            console.error('Animation generation error:', error);
            this.logAgent('Error', error.message);
        }

        this.showLoading(false);
    }

    applyAnimation(animationData) {
        const tracks = [];
        const boneMap = new Map(this.bones.map(b => [b.name, b]));

        // Group keyframes by bone
        const boneKeyframes = new Map();
        animationData.keyframes.forEach(kf => {
            if (!boneKeyframes.has(kf.boneName)) {
                boneKeyframes.set(kf.boneName, []);
            }
            boneKeyframes.get(kf.boneName).push(kf);
        });

        // Create tracks
        boneKeyframes.forEach((keyframes, boneName) => {
            const bone = boneMap.get(boneName);
            if (!bone) return;

            keyframes.sort((a, b) => a.time - b.time);

            // Rotation track
            const times = keyframes.map(kf => kf.time);
            const rotations = keyframes.flatMap(kf => [kf.rotation.x, kf.rotation.y, kf.rotation.z]);

            const rotationTrack = new THREE.QuaternionKeyframeTrack(
                `${bone.name}.quaternion`,
                times,
                rotations.map((_, i) => {
                    const euler = new THREE.Euler(
                        rotations[i * 3],
                        rotations[i * 3 + 1],
                        rotations[i * 3 + 2]
                    );
                    const quat = new THREE.Quaternion().setFromEuler(euler);
                    return i % 4 === 3 ? quat.w : quat[['x', 'y', 'z'][i % 4]];
                })
            );
            tracks.push(rotationTrack);

            // Position track if available
            if (keyframes[0].position) {
                const positions = keyframes.flatMap(kf => [kf.position.x, kf.position.y, kf.position.z]);
                const positionTrack = new THREE.VectorKeyframeTrack(
                    `${bone.name}.position`,
                    times,
                    positions
                );
                tracks.push(positionTrack);
            }
        });

        const clip = new THREE.AnimationClip('generated', animationData.duration, tracks);

        if (this.currentAction) {
            this.currentAction.stop();
        }

        this.currentAction = this.mixer.clipAction(clip);
        this.currentAction.play();

        document.getElementById('play-btn').classList.remove('hidden');
        document.getElementById('pause-btn').classList.remove('hidden');
        document.getElementById('reset-btn').classList.remove('hidden');

        this.logAgent('Playback', 'Animation applied successfully');
    }

    playAnimation() {
        if (this.currentAction) {
            this.currentAction.paused = false;
        }
    }

    pauseAnimation() {
        if (this.currentAction) {
            this.currentAction.paused = true;
        }
    }

    resetAnimation() {
        if (this.currentAction) {
            this.currentAction.stop();
            this.currentAction.play();
        }
    }

    logAgent(agentName, message) {
        const log = document.getElementById('agent-log');
        const entry = document.createElement('div');
        entry.className = 'agent-message';
        entry.innerHTML = `<span class=\"agent-name\">[${agentName}]</span> ${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    onResize() {
        const container = document.getElementById('viewport-container');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        if (this.mixer) {
            this.mixer.update(delta);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new AnimationStudio();