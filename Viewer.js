import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Viewer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.mixer = null;
        this.currentModel = null;

        this.initRenderer();
        this.initCamera();
        this.initControls();
        this.initLighting();
        this.initScene();

        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(50, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 1.5, 4);
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 1, 0);
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
    }

    initScene() {
        this.scene.background = new THREE.Color(0x1a1a1a);
        const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x444444);
        this.scene.add(gridHelper);
    }

    start() {
        this.renderer.setAnimationLoop(() => this.animate());
    }

    animate() {
        const delta = this.clock.getDelta();
        if (this.mixer) {
            this.mixer.update(delta);
        }
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const container = this.canvas.parentElement;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    async loadGLB(url) {
        return new Promise((resolve, reject) => {
            if (this.currentModel) {
                this.scene.remove(this.currentModel);
                this.currentModel = null;
                this.mixer = null;
            }
            const loader = new GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    this.currentModel = gltf.scene;
                    this.scene.add(this.currentModel);

                    const box = new THREE.Box3().setFromObject(this.currentModel);
                    const center = box.getCenter(new THREE.Vector3());
                    this.currentModel.position.sub(center); // center model
                    
                    const boneNames = [];
                    this.currentModel.traverse((object) => {
                        if (object.isBone) {
                            boneNames.push(object.name);
                        }
                    });

                    this.controls.target.set(0, box.getSize(new THREE.Vector3()).y / 2, 0);
                    this.controls.update();

                    resolve({ model: this.currentModel, boneNames });
                },
                undefined,
                (error) => {
                    console.error('An error happened during GLB loading', error);
                    reject(error);
                }
            );
        });
    }

    playAnimation(clip) {
        if (!this.currentModel) return;
        
        if(this.mixer) {
            this.mixer.stopAllAction();
        }
        
        this.mixer = new THREE.AnimationMixer(this.currentModel);
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        action.play();
    }
}

