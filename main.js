import { Viewer } from './Viewer.js';
import { AnimationAgent } from './AnimationAgent.js';

class App {
    constructor() {
        this.viewer = new Viewer(document.getElementById('viewer-canvas'));
        this.animationAgent = null;
        this.modelData = null;

        this.modelInput = document.getElementById('model-input');
        this.promptInput = document.getElementById('prompt-input');
        this.animateButton = document.getElementById('animate-button');
        this.skeletonInfo = document.getElementById('skeleton-info');
        this.loader = document.getElementById('loader');

        this.init();
    }

    init() {
        this.viewer.start();
        this.setupEventListeners();
        console.log("App initialized. Ready to load a model.");
    }

    setupEventListeners() {
        this.modelInput.addEventListener('change', (event) => this.onModelLoad(event));
        this.animateButton.addEventListener('click', () => this.onAnimateClick());
    }

    async onModelLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.setLoading(true, "Loading model...");
        const url = URL.createObjectURL(file);
        
        try {
            this.modelData = await this.viewer.loadGLB(url);
            URL.revokeObjectURL(url);

            if (this.modelData.boneNames.length > 0) {
                this.animationAgent = new AnimationAgent(this.modelData.boneNames);
                this.displaySkeletonInfo(this.modelData.boneNames);
                this.animateButton.disabled = false;
                this.promptInput.placeholder = "Model loaded. e.g., 'Nod head up and down'";
            } else {
                this.displaySkeletonInfo(null, "No skeleton found in the model.");
                this.animateButton.disabled = true;
                this.promptInput.placeholder = "Load a model with a skeleton to enable animation.";
            }
        } catch (error) {
            console.error("Error loading model:", error);
            this.displaySkeletonInfo(null, "Failed to load model.");
        } finally {
            this.setLoading(false);
        }
    }

    async onAnimateClick() {
        if (!this.animationAgent || !this.promptInput.value) {
            alert("Please load a model and enter an animation prompt.");
            return;
        }

        this.setLoading(true, "AI is generating animation...");
        this.animateButton.disabled = true;

        try {
            const prompt = this.promptInput.value;
            const animationClip = await this.animationAgent.generateAnimation(prompt);
            
            if (animationClip) {
                this.viewer.playAnimation(animationClip);
            } else {
                alert("The AI could not generate a valid animation from your prompt. Please try a different description.");
            }

        } catch (error) {
            console.error("Animation generation failed:", error);
            alert("An error occurred during animation generation. Check the console for details.");
        } finally {
            this.setLoading(false);
            this.animateButton.disabled = false;
        }
    }
    
    displaySkeletonInfo(boneNames, message = "") {
        if (message) {
            this.skeletonInfo.innerHTML = `<p>${message}</p>`;
            return;
        }
        if (boneNames && boneNames.length > 0) {
            const list = boneNames.map(name => `<li>${name}</li>`).join('');
            this.skeletonInfo.innerHTML = `<ul>${list}</ul>`;
        } else {
            this.skeletonInfo.innerHTML = `<p>No model loaded.</p>`;
        }
    }
    
    setLoading(isLoading, message = "Loading...") {
        this.loader.classList.toggle('hidden', !isLoading);
        this.loader.querySelector('p').textContent = message;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new App();
});

