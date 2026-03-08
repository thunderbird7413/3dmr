import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class ModelPreview {
	constructor(elementId, options = {}) {
		this.axesHelper = null;
		this.gridHelper = null;
		this.northArrowHelper = null;
		this.frontArrowHelper = null;
		this.htmlLabels = {};
		this.distanceMarkers = {};
		this.labelsContainer = null;
		this.scaleContainer = null;
		this.gridSize = 100;
		this.groundPosition = 0;
		this.mixer = null;

		this.renderPane = document.getElementById(elementId);
		this.options = options;

		if (typeof this.options['width'] === 'undefined')
			this.options['width'] = this.renderPane.clientWidth;

		if (typeof this.options['height'] === 'undefined')
			this.options['height'] = this.renderPane.clientHeight;

		this.initThreeScene();
	}

	initThreeScene() {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(this.options['width'], this.options['height']);
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;
		this.renderer.physicallyCorrectLights = true;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		this.renderPane.appendChild(this.renderer.domElement);

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x87cefa);

		this.camera = new THREE.PerspectiveCamera(75, this.options['width'] / this.options['height'], 0.1, 1000);
		this.resizeCanvas();

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
		this.scene.add(ambLight);

		const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
		dirLight.position.set(5, 10, 7.5);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.width = 2048;
		dirLight.shadow.mapSize.height = 2048;
		dirLight.shadow.bias = -0.0001;
		this.scene.add(dirLight);

		const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6);
		this.scene.add(hemiLight);

		const pointLight = new THREE.PointLight(0xffffff, 1, 100);
		pointLight.position.set(10, 10, 10);
		pointLight.castShadow = true;
		pointLight.shadow.mapSize.width = 2048;
		pointLight.shadow.mapSize.height = 2048;
		pointLight.shadow.camera.near = 0.5;
		pointLight.shadow.camera.far = 500;
		pointLight.shadow.camera.fov = 50;
		this.scene.add(pointLight);

		this.renderer.render(this.scene, this.camera);
	}

	displayModel(gltf) {
		const object = gltf.scene;
		this.scene.add(object);

		object.traverse((child) => {
			if (child.isMesh) {
				child.castShadow = true;
				child.receiveShadow = true;
			}
		});

		const bbox = new THREE.Box3().setFromObject(object);
		const center = bbox.getCenter(new THREE.Vector3());
		const size = bbox.getSize(new THREE.Vector3());
		this.groundPosition = -size.y / 2 - bbox.min.y;

		object.position.sub(center);

		const maxDim = Math.max(size.x, size.y, size.z);
		const fov = this.camera.fov * (Math.PI / 180);
		const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
		this.camera.position.set(center.x, center.y, cameraZ * 1.5);
		this.camera.lookAt(new THREE.Vector3(0, 0, 0));

		if (maxDim >= 5)
			this.gridSize = Math.ceil(maxDim / 50) * 50;
		else
			this.gridSize = maxDim;

		if (gltf.animations && gltf.animations.length > 0) {
			this.mixer = new THREE.AnimationMixer(object);
			gltf.animations.forEach((clip) => {
				this.mixer.clipAction(clip).play();
			});
		}

		this.setupFullscreenButton();
		this.animate();
	}

	loadAndDisplay(url, onLoaded) {
		const loader = new GLTFLoader();

		loader.load(url, (gltf) => {
			this.displayModel(gltf);
			if (onLoaded) onLoaded(gltf);
		}, undefined, (error) => {
			console.error("Error loading GLB:", error);
		});
	}

	animate() {
		const clock = new THREE.Clock();

		const loop = () => {
			requestAnimationFrame(loop);

			const delta = clock.getDelta();

			if (this.mixer) this.mixer.update(delta);

			this.resizeCanvas();

			this.controls.update();

			if (document.fullscreenElement) {
				this.updateLabels();
			}

			this.renderer.render(this.scene, this.camera);
		};

		loop();
	}

	resizeCanvas() {
		const canvas = this.renderer.domElement;

		canvas.style = null;
		let width, height;
		if (document.fullscreenElement === this.renderPane) {
			width = window.innerWidth;
			height = window.innerHeight;
		} else {
			width = this.options['width'];
			height = this.options['height'];
		}

		if (canvas.width != width || canvas.height != height) {
			this.renderer.setSize(width, height, false);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
		}
	}

	toggleVisualHelpers(enable) {
		if (enable) {
			if (!this.axesHelper) {
				this.axesHelper = new THREE.AxesHelper(this.gridSize / 2);
				this.axesHelper.position.y = this.groundPosition;
				this.scene.add(this.axesHelper);
			}

			if (!this.gridHelper) {
				this.gridHelper = new THREE.GridHelper(this.gridSize);
				this.gridHelper.position.y = this.groundPosition;
				this.scene.add(this.gridHelper);
			}

			const z_dir = new THREE.Vector3(0, 0, 1);
			const neg_z_dir = new THREE.Vector3(0, 0, -1);
			const origin = new THREE.Vector3(0, this.groundPosition, 0);
			const length = this.gridSize * 1.1 / 2;
			const gridSpacing = this.gridSize / 10;

			if (!this.northArrowHelper) {
				this.northArrowHelper = new THREE.ArrowHelper(neg_z_dir, origin, length, 0xFFD700, gridSpacing * 0.3, 0.1 * gridSpacing);
				this.scene.add(this.northArrowHelper);
			}
			if (!this.frontArrowHelper) {
				this.frontArrowHelper = new THREE.ArrowHelper(z_dir, origin, length, 0x0000FF, gridSpacing * 0.3, 0.1 * gridSpacing);
				this.scene.add(this.frontArrowHelper);
			}

			this.labelsContainer = document.getElementById('labels-container');
			if (this.labelsContainer) {
				this.labelsContainer.style.display = 'block';
				if (Object.keys(this.htmlLabels).length === 0) {
					this.labelsContainer = document.getElementById('labels-container');
					if (!this.labelsContainer) return;

					this.labelsContainer.innerHTML = '';
					this.htmlLabels = {};

					this.htmlLabels.x = this.createLabelElement('X', 'red');
					this.htmlLabels.y = this.createLabelElement('Y', 'green');
					this.htmlLabels.z = this.createLabelElement('Z', 'blue');
					this.htmlLabels.front = this.createLabelElement('Front', 'blue');
					this.htmlLabels.north = this.createLabelElement('North', 'yellow');
					this.labelsContainer.appendChild(this.htmlLabels.x);
					this.labelsContainer.appendChild(this.htmlLabels.y);
					this.labelsContainer.appendChild(this.htmlLabels.z);
					this.labelsContainer.appendChild(this.htmlLabels.front);
					this.labelsContainer.appendChild(this.htmlLabels.north);

					this.distanceMarkers = {};

					for (let i = -5; i <= 5; i++) {
						const distance = i * gridSpacing;
						this.distanceMarkers[`marker_x_${i}`] = this.createLabelElement(`${distance.toFixed(1)}`, 'skyblue');
						this.labelsContainer.appendChild(this.distanceMarkers[`marker_x_${i}`]);
						this.distanceMarkers[`marker_z_${i}`] = this.createLabelElement(`${distance.toFixed(1)}`, 'skyblue');
						this.labelsContainer.appendChild(this.distanceMarkers[`marker_z_${i}`]);
					}
				}
			}

			this.scaleContainer = document.getElementById('scale-container');
			if (this.scaleContainer) {
				this.scaleContainer.style.display = 'block';
				if (!this.gridSize) return;

				const gridSpacingEl = document.getElementById('grid-spacing-value');
				if (gridSpacingEl) gridSpacingEl.textContent = `${gridSpacing.toFixed(1)}m`;
			}
		} else {
			if (this.axesHelper) {
				this.scene.remove(this.axesHelper);
				this.axesHelper.dispose();
				this.axesHelper = null;
			}

			if (this.gridHelper) {
				this.scene.remove(this.gridHelper);
				this.gridHelper.dispose();
				this.gridHelper = null;
			}

			if (this.northArrowHelper) {
				this.scene.remove(this.northArrowHelper);
				this.northArrowHelper.dispose();
				this.northArrowHelper = null;
			}
			if (this.frontArrowHelper) {
				this.scene.remove(this.frontArrowHelper);
				this.frontArrowHelper.dispose();
				this.frontArrowHelper = null;
			}

			if (this.labelsContainer) {
				this.labelsContainer.style.display = 'none';
			}

			if (this.scaleContainer) {
				this.scaleContainer.style.display = 'none';
			}
		}
	}

	createLabelElement(text, color) {
		const div = document.createElement('div');
		div.className = 'axis-label';
		div.style.color = color;
		div.textContent = text;
		return div;
	}

	updateLabels() {
		if (!this.labelsContainer || this.labelsContainer.style.display === 'none' || !this.camera) return;

		const tempV = new THREE.Vector3();
		const label3DPositions = {
			x: new THREE.Vector3(this.gridSize / 2, this.groundPosition, 0),
			y: new THREE.Vector3(0, this.gridSize / 2 + this.groundPosition, 0),
			z: new THREE.Vector3(0, this.groundPosition, this.gridSize / 2),
			north: new THREE.Vector3(0, this.groundPosition, -this.gridSize * 1.11 / 2),
			front: new THREE.Vector3(0, this.groundPosition, this.gridSize * 1.11 / 2),
		};

		for (const labelItem in { x: true, y: true, z: true, north: true, front: true }) {
			const label = this.htmlLabels[labelItem];
			const position = label3DPositions[labelItem];

			tempV.copy(position);
			tempV.project(this.camera);

			const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
			const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight;

			label.style.left = `${x}px`;
			label.style.top = `${y}px`;
		}

		if (Object.keys(this.distanceMarkers).length > 0) {
			const gridSpacing = this.gridSize / 10;

			for (let i = -5; i <= 5; i++) {
				const marker_x = this.distanceMarkers[`marker_x_${i}`];
				const marker_z = this.distanceMarkers[`marker_z_${i}`];
				if (marker_x) {
					const markerPositionX = new THREE.Vector3(
						-this.gridSize / 2,
						this.groundPosition,
						(i * gridSpacing),
					);

					tempV.copy(markerPositionX);
					tempV.project(this.camera);
					const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
					const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight;
					marker_x.style.left = `${x}px`;
					marker_x.style.top = `${y}px`;
				}
				if (marker_z) {
					const markerPositionZ = new THREE.Vector3(
						(i * gridSpacing),
						this.groundPosition,
						-this.gridSize / 2
					);

					tempV.copy(markerPositionZ);
					tempV.project(this.camera);
					const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
					const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight;
					marker_z.style.left = `${x}px`;
					marker_z.style.top = `${y}px`;
				}
			}
		}
	}

	handleFullscreenChange() {
		const isFullscreen = document.fullscreenElement === this.renderPane;

		if (isFullscreen) {
			this.toggleVisualHelpers(true);
		} else {
			this.toggleVisualHelpers(false);
		}

		this.resizeCanvas();
	}

	setupFullscreenButton() {
		const fullscreenButton = document.getElementById('fullscreen-button');
		if (!fullscreenButton) return;

		fullscreenButton.addEventListener('click', () => {
			if (!document.fullscreenElement && this.renderPane.requestFullscreen) {
				this.renderPane.requestFullscreen();
			} else if (document.exitFullscreen) {
				document.exitFullscreen();
			}
		});

		document.addEventListener('fullscreenchange', () => {
			this.handleFullscreenChange();
		});
	}
}

function setUpRenderPane(onLoaded) {
	const elems = document.querySelectorAll('div.render-pane');

	for (const elem of elems) {
		const model_id = elem.dataset.model;
		const revision = elem.dataset.revision;
		const url = "/api/model/" + model_id + "/" + revision;

		const preview = new ModelPreview(elem.id);
		preview.loadAndDisplay(url, onLoaded);
	}
}

function displayPreview(elementId, url, options = {}, onLoaded) {
	const preview = new ModelPreview(elementId, options);
	preview.loadAndDisplay(url, onLoaded);
}

window.ModelPreview = ModelPreview;
window.setUpRenderPane = setUpRenderPane;
window.displayPreview = displayPreview;
