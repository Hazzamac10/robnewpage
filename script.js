class BuildingGenerator {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.building = null;
        this.ambientLight = null;
        this.directionalLight = null;
        this.buildingParts = {};
        this.animationId = null;
        this.heroScene = null;
        this.heroCamera = null;
        this.heroRenderer = null;
        this.heroAnimId = null;
        this.designerEnabled = !!document.getElementById('canvas');
        
        if (this.designerEnabled) {
            this.init();
        }
        this.initHeroAnimation();
        this.setupEventListeners();
        this.setupNavigation();
        if (!this.designerEnabled) {
            this.initRevealObserver();
        }
        if (this.designerEnabled) {
            this.generateInitialBuilding();
        }
        // Ensure estimate labels/values render immediately on load
        this.calculateEstimate();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 50, 200);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.5, // increase near plane to improve depth precision
            300   // reduce far plane to minimize z-fighting
        );
        this.camera.position.set(30, 20, 30);

        // Create renderer
        const canvas = document.getElementById('canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true,
            logarithmicDepthBuffer: true
        });
        this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
        // Ensure renderer uses the actual canvas size (square from CSS)
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Add controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 100;

        // Add lights
        this.setupLights();

        // Add ground
        this.addGround();

        // Start render loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Reveal observer
        this.initRevealObserver();
    }

    setupLights() {
        // Ambient light
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(this.ambientLight);

        // Directional light (sun)
        this.directionalLight = new THREE.DirectionalLight(0x00d4ff, 1);
        this.directionalLight.position.set(50, 50, 50);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 200;
        this.directionalLight.shadow.camera.left = -50;
        this.directionalLight.shadow.camera.right = 50;
        this.directionalLight.shadow.camera.top = 50;
        this.directionalLight.shadow.camera.bottom = -50;
        this.scene.add(this.directionalLight);

        // Point lights for futuristic glow
        const pointLight1 = new THREE.PointLight(0x00ff88, 0.5, 100);
        pointLight1.position.set(-20, 10, -20);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x0099cc, 0.5, 100);
        pointLight2.position.set(20, 10, 20);
        this.scene.add(pointLight2);

        // Hemisphere light for overall sky/ground illumination
        const hemiLight = new THREE.HemisphereLight(0x8ecaff, 0x0b1220, 0.4);
        this.scene.add(hemiLight);
    }

    addGround() {
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.8,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add grid
        const gridHelper = new THREE.GridHelper(200, 50, 0x00d4ff, 0x00d4ff);
        gridHelper.material.opacity = 0.1;
        gridHelper.material.transparent = true;
        gridHelper.material.depthWrite = false;
        gridHelper.renderOrder = -1; // draw behind to avoid z-fight
        this.scene.add(gridHelper);
    }

    generateBuilding(floors, volume, surfaceArea, style) {
        this.showLoading(true);

        // Remove existing building efficiently
        if (this.building) {
            this.scene.remove(this.building);
            this.building.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose?.();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
                    else obj.material.dispose?.();
                }
                if (obj.texture) obj.texture.dispose?.();
            });
        }

        // Calculate dimensions
        const floorHeight = 3.5; // meters per floor
        const totalHeight = floors * floorHeight;
        
        // Calculate base dimensions from volume and surface area
        const baseArea = surfaceArea / floors;
        const width = Math.sqrt(baseArea) * 1.5; // Bigger square footprint
        const depth = Math.sqrt(baseArea) * 1.5; // Bigger square footprint

        // Get feature toggles
        const features = this.getFeatureToggles();

        // Create building group
        this.building = new THREE.Group();
        this.building.matrixAutoUpdate = false; // reduce per-frame updates

        // Generate building based on style
        switch (style) {
            case 'modern':
                this.createModernBuilding(floors, width, depth, totalHeight, floorHeight, features);
                break;
            case 'cyberpunk':
                this.createCyberpunkBuilding(floors, width, depth, totalHeight, floorHeight, features);
                break;
            case 'organic':
                this.createOrganicBuilding(floors, width, depth, totalHeight, floorHeight, features);
                break;
            case 'geometric':
                this.createGeometricBuilding(floors, width, depth, totalHeight, floorHeight, features);
                break;
            case 'townhouse':
                this.createTownhouse(floors, width, depth, totalHeight, floorHeight, features);
                break;
            case 'terrace':
                this.createTerraceHouse(floors, width, depth, totalHeight, floorHeight, features);
                break;
            case 'uk-detached':
                this.createUKDetached(floors, width, depth, totalHeight, floorHeight, features);
                break;
        }

        // Add building to scene
        this.scene.add(this.building);
        this.building.updateMatrixWorld(true);

        // Auto-frame camera to building
        this.frameCameraToObject(this.building);

        // Update info panel
        this.updateInfoPanel(width, depth, totalHeight, floorHeight);

        // Hide loading fast
        this.showLoading(false);
    }

    frameCameraToObject(obj) {
        if (!obj) return;
        const bbox = new THREE.Box3().setFromObject(obj);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fitHeightDistance = maxDim / (2 * Math.atan((Math.PI * this.camera.fov) / 360));
        const fitWidthDistance = fitHeightDistance / this.camera.aspect;
        const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.3; // padding

        // Position camera on a diagonal above the object
        this.camera.position.set(center.x + distance, center.y + distance * 0.5, center.z + distance);
        this.controls.target.copy(center);
        this.controls.update();
        this.camera.updateProjectionMatrix();
    }

    getFeatureToggles() {
        return {
            roof: document.getElementById('show-roof').checked,
            windows: document.getElementById('show-windows').checked,
            balconies: document.getElementById('show-balconies').checked,
            lighting: document.getElementById('show-lighting').checked,
            solarPanels: document.getElementById('show-solar-panels').checked,
            neonFrames: document.getElementById('show-neon-frames').checked,
            slabs: (document.getElementById('show-slabs') || { checked: true }).checked,
            walls: (document.getElementById('show-walls') || { checked: true }).checked,
            columns: (document.getElementById('show-columns') || { checked: true }).checked,
            beams: (document.getElementById('show-beams') || { checked: true }).checked,
            plates: (document.getElementById('show-plates') || { checked: true }).checked
        };
    }

    createModernBuilding(floors, width, depth, height, floorHeight, features) {
        // Main structure with realistic proportions
        const mainGeometry = new THREE.BoxGeometry(width, height, depth);
        const mainMaterial = new THREE.MeshPhongMaterial({
            color: 0x3a3a4e,
            transparent: true,
            opacity: 0.95
        });
        const mainBuilding = new THREE.Mesh(mainGeometry, mainMaterial);
        mainBuilding.position.y = height / 2;
        mainBuilding.castShadow = true;
        mainBuilding.receiveShadow = true;
        this.building.add(mainBuilding);

        // Add foundation
        this.addFoundation(width, depth);

        // Add exterior walls with texture
        this.addExteriorWalls(width, depth, height, floorHeight);

        // Realistic windows with frames and sills
        if (features.windows) {
            this.addModernWindows(width, depth, height, floors, floorHeight);
        }

        // Add doors
        this.addDoors(width, depth, floorHeight);

        // Modern roof with proper structure
        if (features.roof) {
            this.addModernRoof(width, depth, height);
        }
        
        // Balconies with railings
        if (features.balconies) {
            this.addBalconies(width, depth, height, floors, floorHeight);
        }
        
        // LED accent lighting
        if (features.lighting) {
            this.addModernLighting(width, depth, height, floors, floorHeight);
        }

        // Add architectural details
        this.addArchitecturalDetails(width, depth, height, floors, floorHeight);
    }

    createCyberpunkBuilding(floors, width, depth, height, floorHeight, features) {
        // Main structure with realistic proportions
        const mainGeometry = new THREE.BoxGeometry(width, height, depth);
        const mainMaterial = new THREE.MeshPhongMaterial({
            color: 0x2a1a3e,
            transparent: true,
            opacity: 0.95
        });
        const mainBuilding = new THREE.Mesh(mainGeometry, mainMaterial);
        mainBuilding.position.y = height / 2;
        mainBuilding.castShadow = true;
        mainBuilding.receiveShadow = true;
        this.building.add(mainBuilding);

        // Add foundation
        this.addFoundation(width, depth);

        // Add exterior walls with cyberpunk texture
        this.addCyberpunkWalls(width, depth, height, floorHeight);

        // Cyberpunk windows with neon frames
        if (features.windows) {
            this.addCyberpunkWindows(width, depth, height, floors, floorHeight, features);
        }

        // Add cyberpunk doors
        this.addCyberpunkDoors(width, depth, floorHeight);

        // Futuristic roof with solar panels
        if (features.roof) {
            this.addCyberpunkRoof(width, depth, height, features);
        }
        
        // Tech balconies
        if (features.balconies) {
            this.addTechBalconies(width, depth, height, floors, floorHeight);
        }
        
        // Neon lighting system
        if (features.lighting) {
            this.addNeonLighting(width, depth, height, floors, floorHeight);
        }

        // Add cyberpunk architectural details
        this.addCyberpunkDetails(width, depth, height, floors, floorHeight);
    }

    createOrganicBuilding(floors, width, depth, height, floorHeight, features) {
        // Main structure with organic curves but still building-like
        const mainGeometry = new THREE.BoxGeometry(width, height, depth);
        const mainMaterial = new THREE.MeshPhongMaterial({
            color: 0x3e2a1a,
            transparent: true,
            opacity: 0.95
        });
        const mainBuilding = new THREE.Mesh(mainGeometry, mainMaterial);
        mainBuilding.position.y = height / 2;
        mainBuilding.castShadow = true;
        mainBuilding.receiveShadow = true;
        this.building.add(mainBuilding);

        // Organic windows with flowing shapes
        if (features.windows) {
            for (let i = 0; i < floors; i++) {
            // Curved windows
            for (let j = 0; j < 2; j++) {
                const windowGeometry = new THREE.CircleGeometry(width * 0.15, 16);
                const windowMaterial = new THREE.MeshPhongMaterial({
                    color: 0x00d4ff,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide
                });
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(
                    (j - 0.5) * width * 0.5,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.01
                );
                this.building.add(window);
            }

            // Side windows
            const sideWindowGeometry = new THREE.EllipseGeometry(width * 0.2, floorHeight * 0.4, 16);
            const sideWindowMaterial = new THREE.MeshPhongMaterial({
                color: 0x00d4ff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            const sideWindow = new THREE.Mesh(sideWindowGeometry, sideWindowMaterial);
            sideWindow.position.set(width / 2 + 0.01, i * floorHeight + floorHeight / 2, 0);
            sideWindow.rotation.y = Math.PI / 2;
            this.building.add(sideWindow);
            }
        }

        // Organic roof
        if (features.roof) {
            this.addOrganicRoof(width, depth, height);
        }
        
        // Flowing balconies
        if (features.balconies) {
            this.addFlowingBalconies(width, depth, height, floors, floorHeight);
        }
        
        // Natural lighting
        if (features.lighting) {
            this.addNaturalLighting(width, depth, height, floors, floorHeight);
        }
    }

    createGeometricBuilding(floors, width, depth, height, floorHeight, features) {
        // Angular main structure
        const mainGeometry = new THREE.BoxGeometry(width, height, depth);
        const mainMaterial = new THREE.MeshPhongMaterial({
            color: 0x2a2a3e,
            transparent: true,
            opacity: 0.95
        });
        const mainBuilding = new THREE.Mesh(mainGeometry, mainMaterial);
        mainBuilding.position.y = height / 2;
        mainBuilding.castShadow = true;
        mainBuilding.receiveShadow = true;
        this.building.add(mainBuilding);

        // Geometric windows with precise angles
        if (features.windows) {
            for (let i = 0; i < floors; i++) {
            // Hexagonal windows
            for (let j = 0; j < 3; j++) {
                const windowGeometry = new THREE.ConeGeometry(width * 0.1, floorHeight * 0.4, 6);
                const windowMaterial = new THREE.MeshPhongMaterial({
                    color: 0x0099cc,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide
                });
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(
                    (j - 1) * width * 0.3,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.01
                );
                window.rotation.z = Math.PI;
                this.building.add(window);
            }
            }
        }

        // Geometric roof
        if (features.roof) {
            this.addGeometricRoof(width, depth, height);
        }
        
        // Angular balconies
        if (features.balconies) {
            this.addAngularBalconies(width, depth, height, floors, floorHeight);
        }
        
        // Precise lighting
        if (features.lighting) {
            this.addPreciseLighting(width, depth, height, floors, floorHeight);
        }

    }

    addExtension(side, length, width, floors) {
        if (!this.building) return;
        // Estimate main building size from current group bounding box
        const bbox = new THREE.Box3().setFromObject(this.building);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bbox.getSize(size);
        bbox.getCenter(center);

        const floorHeight = 3.5;
        const extHeight = floors * floorHeight;

        const extGeom = new THREE.BoxGeometry(width, extHeight, length);
        const extMat = new THREE.MeshPhongMaterial({ color: 0x8b9bb4, transparent: true, opacity: 0.95 });
        const ext = new THREE.Mesh(extGeom, extMat);
        ext.castShadow = true;
        ext.receiveShadow = true;

        // Position extension relative to main house
        ext.position.y = extHeight / 2; // sit on ground
        const offset = 0.05 * Math.max(size.x, size.z); // small gap overlap fudge
        switch (side) {
            case 'front':
                ext.position.z = bbox.max.z + length / 2 - offset;
                break;
            case 'back':
                ext.position.z = bbox.min.z - length / 2 + offset;
                break;
            case 'left':
                ext.position.x = bbox.min.x - width / 2 + offset;
                break;
            case 'right':
            default:
                ext.position.x = bbox.max.x + width / 2 - offset;
                break;
        }

        this.building.add(ext);

        // Simple flat roof for extension if roof feature enabled
        const features = this.getFeatureToggles();
        if (features.roof) {
            const roofGeom = new THREE.BoxGeometry(width * 1.02, 0.2, length * 1.02);
            const roofMat = new THREE.MeshPhongMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.95 });
            const roof = new THREE.Mesh(roofGeom, roofMat);
            roof.position.set(ext.position.x, extHeight + 0.1, ext.position.z);
            roof.castShadow = true;
            this.building.add(roof);
        }
    }

    // Modern Building Features
    addModernRoof(width, depth, height) {
        const roofGeometry = new THREE.ConeGeometry(width * 0.7, height * 0.2, 4);
        const roofMaterial = new THREE.MeshPhongMaterial({
            color: 0x4a4a5e,
            transparent: true,
            opacity: 0.9
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, height + height * 0.1, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        this.building.add(roof);
    }

    addBalconies(width, depth, height, floors, floorHeight) {
        for (let i = 1; i < floors; i += 2) {
            const balconyGeometry = new THREE.BoxGeometry(width * 0.8, 0.2, depth * 0.3);
            const balconyMaterial = new THREE.MeshPhongMaterial({
                color: 0x5a5a6e,
                transparent: true,
                opacity: 0.9
            });
            const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
            balcony.position.set(0, i * floorHeight + floorHeight / 2, depth / 2 + depth * 0.15);
            balcony.castShadow = true;
            this.building.add(balcony);

            // Balcony railing
            const railingGeometry = new THREE.BoxGeometry(width * 0.8, floorHeight * 0.3, 0.1);
            const railingMaterial = new THREE.MeshPhongMaterial({
                color: 0x6a6a7e,
                transparent: true,
                opacity: 0.8
            });
            const railing = new THREE.Mesh(railingGeometry, railingMaterial);
            railing.position.set(0, i * floorHeight + floorHeight / 2 + floorHeight * 0.15, depth / 2 + depth * 0.2);
            this.building.add(railing);
        }
    }

    addModernLighting(width, depth, height, floors, floorHeight) {
        for (let i = 0; i < floors; i++) {
            const lightGeometry = new THREE.BoxGeometry(width * 0.9, 0.05, 0.05);
            const lightMaterial = new THREE.MeshBasicMaterial({
                color: 0x00d4ff,
                transparent: true,
                opacity: 0.8
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(0, i * floorHeight + floorHeight / 2, depth / 2 + 0.1);
            this.building.add(light);
        }
    }

    // Cyberpunk Building Features
    addCyberpunkRoof(width, depth, height, features) {
        const roofGeometry = new THREE.ConeGeometry(width * 0.6, height * 0.25, 8);
        const roofMaterial = new THREE.MeshPhongMaterial({
            color: 0x3a1a4e,
            transparent: true,
            opacity: 0.9
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, height + height * 0.125, 0);
        roof.castShadow = true;
        this.building.add(roof);

        // Solar panels
        if (features.solarPanels) {
            const panelGeometry = new THREE.BoxGeometry(width * 0.3, 0.1, depth * 0.4);
            const panelMaterial = new THREE.MeshPhongMaterial({
                color: 0x1a1a1a,
                transparent: true,
                opacity: 0.9
            });
            const panel = new THREE.Mesh(panelGeometry, panelMaterial);
            panel.position.set(0, height + height * 0.2, 0);
            this.building.add(panel);
        }
    }

    addTechBalconies(width, depth, height, floors, floorHeight) {
        for (let i = 1; i < floors; i += 3) {
            const balconyGeometry = new THREE.BoxGeometry(width * 0.4, 0.1, depth * 0.2);
            const balconyMaterial = new THREE.MeshPhongMaterial({
                color: 0x4a1a5e,
                transparent: true,
                opacity: 0.9
            });
            const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
            balcony.position.set(width * 0.3, i * floorHeight + floorHeight / 2, depth / 2 + depth * 0.1);
            balcony.castShadow = true;
            this.building.add(balcony);
        }
    }

    addNeonLighting(width, depth, height, floors, floorHeight) {
        for (let i = 0; i < floors; i++) {
            const neonGeometry = new THREE.TorusGeometry(width * 0.15, 0.05, 8, 16);
            const neonMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0080,
                transparent: true,
                opacity: 0.9
            });
            const neon = new THREE.Mesh(neonGeometry, neonMaterial);
            neon.position.set(0, i * floorHeight + floorHeight / 2, depth / 2 + depth * 0.2);
            neon.rotation.x = Math.PI / 2;
            this.building.add(neon);
        }
    }

    // Organic Building Features
    addOrganicRoof(width, depth, height) {
        const roofGeometry = new THREE.SphereGeometry(width * 0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const roofMaterial = new THREE.MeshPhongMaterial({
            color: 0x4e2a1a,
            transparent: true,
            opacity: 0.9
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, height + height * 0.1, 0);
        roof.castShadow = true;
        this.building.add(roof);
    }

    addFlowingBalconies(width, depth, height, floors, floorHeight) {
        for (let i = 1; i < floors; i += 2) {
            const balconyGeometry = new THREE.SphereGeometry(width * 0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            const balconyMaterial = new THREE.MeshPhongMaterial({
                color: 0x5e2a1a,
                transparent: true,
                opacity: 0.8
            });
            const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
            balcony.position.set(
                Math.sin(i * 0.3) * width * 0.3,
                i * floorHeight + floorHeight / 2,
                depth / 2 + depth * 0.1
            );
            balcony.castShadow = true;
            this.building.add(balcony);
        }
    }

    addNaturalLighting(width, depth, height, floors, floorHeight) {
        for (let i = 0; i < floors; i++) {
            const lightGeometry = new THREE.SphereGeometry(width * 0.05, 8, 6);
            const lightMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.7
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(
                Math.sin(i * 0.5) * width * 0.4,
                i * floorHeight + floorHeight / 2,
                Math.cos(i * 0.5) * depth * 0.4
            );
            this.building.add(light);
        }
    }

    // Geometric Building Features
    addGeometricRoof(width, depth, height) {
        const roofGeometry = new THREE.ConeGeometry(width * 0.5, height * 0.3, 6);
        const roofMaterial = new THREE.MeshPhongMaterial({
            color: 0x3a2a4e,
            transparent: true,
            opacity: 0.9
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, height + height * 0.15, 0);
        roof.castShadow = true;
        this.building.add(roof);
    }

    addAngularBalconies(width, depth, height, floors, floorHeight) {
        for (let i = 1; i < floors; i += 2) {
            const balconyGeometry = new THREE.ConeGeometry(width * 0.2, depth * 0.2, 6);
            const balconyMaterial = new THREE.MeshPhongMaterial({
                color: 0x4a2a5e,
                transparent: true,
                opacity: 0.8
            });
            const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
            balcony.position.set(
                (i % 2 === 0 ? 1 : -1) * width * 0.3,
                i * floorHeight + floorHeight / 2,
                depth / 2 + depth * 0.1
            );
            balcony.rotation.z = Math.PI;
            balcony.castShadow = true;
            this.building.add(balcony);
        }
    }

    // Floor Plan House (exact blueprint recreation)
    createUKDetached(floors, width, depth, height, floorHeight, features) {
        // Convert feet to units (1 foot = 1 unit for accuracy)
        const scale = 1.0;
        
        // Ground reference
        const groundY = 0;

        // Foundation for entire complex shape
        this.addFoundation(70, 40); // Larger foundation for L-shape

        // Main house material
        const houseMat = new THREE.MeshPhongMaterial({ 
            color: 0xd4a574, // Warm brick color
            transparent: true, 
            opacity: 0.95 
        });

        // Ensure parts map exists
        if (!this.buildingParts) this.buildingParts = {};

        // CENTRAL CORE - Great Room, Kitchen, Dining, Entry
        const coreWidth = 35 * scale;  // Main central area
        const coreDepth = 25 * scale;
        const coreHeight = 10 * scale;
        const coreX = 0;
        const coreZ = 0;
        this.addBlockStructure('core', coreX, coreZ, groundY, coreWidth, coreDepth, coreHeight);

        // LEFT WING - Bedrooms 2 & 3, Bath, Hall
        const leftWingWidth = 15 * scale;
        const leftWingDepth = 25 * scale;
        const leftWingHeight = 9 * scale; // Slightly lower ceiling
        
        const leftWingX = -(coreWidth / 2 + leftWingWidth / 2);
        const leftWingZ = 0;
        this.addBlockStructure('leftWing', leftWingX, leftWingZ, groundY, leftWingWidth, leftWingDepth, leftWingHeight);

        // RIGHT WING - Master Suite
        const masterWingWidth = 18 * scale;
        const masterWingDepth = 20 * scale;
        const masterWingHeight = 9 * scale;
        
        const masterX = (coreWidth / 2 + masterWingWidth / 2);
        const masterZ = -(coreDepth / 2 - masterWingDepth / 2) - 2;
        this.addBlockStructure('masterWing', masterX, masterZ, groundY, masterWingWidth, masterWingDepth, masterWingHeight);

        // TWO-CAR GARAGE - Attached to right side
        const garageWidth = 24 * scale;  // 24' x 22' garage
        const garageDepth = 22 * scale;
        const garageHeight = 9 * scale;
        
        const garageX = (coreWidth / 2 + masterWingWidth + garageWidth / 2) + 2;
        const garageZ = (coreDepth / 2 - garageDepth / 2) + 2;
        this.addBlockStructure('garage', garageX, garageZ, groundY, garageWidth, garageDepth, garageHeight, { color: 0xcaa06a });

        // BREAKFAST NOOK (rear bump-out)
        const breakfastW = 11.5 * scale;
        const breakfastD = 8 * scale;
        const breakfastH = 9 * scale;
        const breakfastX = coreWidth * 0.15;
        const breakfastZ = -(coreDepth / 2 + breakfastD / 2);
        this.addBlockStructure('breakfast', breakfastX, breakfastZ, groundY, breakfastW, breakfastD, breakfastH, { color: 0xd8b07b });

        // DINING (front bump-out)
        const diningW = 11.5 * scale;
        const diningD = 12 * scale;
        const diningH = 9 * scale;
        const diningX = coreWidth * 0.15;
        const diningZ = (coreDepth / 2 + diningD / 2);
        this.addBlockStructure('dining', diningX, diningZ, groundY, diningW, diningD, diningH, { color: 0xd8b07b });

        // Connecting walls between sections
        this.addConnectingWalls(coreWidth, coreDepth, coreHeight, masterWingWidth, masterWingDepth, masterWingHeight, garageWidth, garageDepth, garageHeight, groundY, houseMat);

        // Covered porches (rear porch centered on back of Great Room, front porch at lower-left)
        this.addFloorPlanPorches(coreWidth, coreDepth, coreHeight, coreX, groundY);

        // Roofs
        if (features.roof) {
            this.addFloorPlanRoof(coreWidth, coreDepth, coreHeight, coreX, groundY);
            this.addFloorPlanWingRoof(leftWingWidth, leftWingDepth, leftWingHeight, leftWingX, leftWingZ, groundY);
            this.addFloorPlanWingRoof(masterWingWidth, masterWingDepth, masterWingHeight, masterX, masterZ, groundY);
            this.addFloorPlanGarageRoof(garageWidth, garageDepth, garageHeight, garageX, garageZ, groundY);
        }

        // Windows and doors
        if (features.windows) {
            this.addFloorPlanWindows(coreWidth, coreDepth, coreHeight, coreX, groundY);
            this.addFloorPlanWingWindows(leftWingWidth, leftWingDepth, leftWingHeight, leftWingX, leftWingZ, groundY);
            this.addFloorPlanWingWindows(masterWingWidth, masterWingDepth, masterWingHeight, masterX, masterZ, groundY);
        }

        this.addFloorPlanDoors(garageWidth, garageHeight, garageDepth, garageX, garageZ, groundY);

        // Interior features
        this.addFloorPlanInterior(coreWidth, coreDepth, coreHeight, coreX, groundY);

        // Details
        if (features.lighting) {
            this.addFloorPlanDetails(coreWidth, coreDepth, coreHeight, garageWidth, garageHeight, garageDepth, groundY);
        }

        // Scale overall footprint to match requested width/depth while preserving height
        // Base layout was designed around approximately 70 (w) x 40 (d)
        const baseFootprintWidth = 70;
        const baseFootprintDepth = 40;
        const scaleX = width / baseFootprintWidth;
        const scaleZ = depth / baseFootprintDepth;
        this.building.scale.x *= scaleX;
        this.building.scale.z *= scaleZ;
    }

    addUKGableRoof(w, d, h, cx, groundY) {
        // Better gable roof with proper slope
        const roofHeight = h * 0.4;
        const roofMat = new THREE.MeshPhongMaterial({ 
            color: 0x4a4a4a, // Darker roof tiles
            transparent: true, 
            opacity: 0.95 
        });

        // Left slope
        const leftSlope = new THREE.BoxGeometry(w * 0.6, roofHeight, d);
        const left = new THREE.Mesh(leftSlope, roofMat);
        left.position.set(cx - w * 0.1, h + roofHeight / 2 + groundY, 0);
        left.rotation.z = Math.PI / 8;
        left.castShadow = true;
        this.building.add(left);

        // Right slope
        const rightSlope = new THREE.BoxGeometry(w * 0.6, roofHeight, d);
        const right = new THREE.Mesh(rightSlope, roofMat);
        right.position.set(cx + w * 0.1, h + roofHeight / 2 + groundY, 0);
        right.rotation.z = -Math.PI / 8;
        right.castShadow = true;
        this.building.add(right);

        // White bargeboards
        const whiteMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95 
        });
        
        const bargeboard1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.05, roofHeight * 0.8, 0.1), whiteMat);
        bargeboard1.position.set(cx - w * 0.25, h + roofHeight * 0.4 + groundY, d / 2 + 0.05);
        this.building.add(bargeboard1);

        const bargeboard2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.05, roofHeight * 0.8, 0.1), whiteMat);
        bargeboard2.position.set(cx + w * 0.25, h + roofHeight * 0.4 + groundY, d / 2 + 0.05);
        this.building.add(bargeboard2);
    }

    addUKGarageRoof(w, d, h, cx, cz, groundY) {
        // Flat garage roof with slight slope
        const roofHeight = h * 0.15;
        const roofMat = new THREE.MeshPhongMaterial({ 
            color: 0x4a4a4a, // Dark roof tiles
            transparent: true, 
            opacity: 0.95 
        });
        
        const garageRoof = new THREE.Mesh(new THREE.BoxGeometry(w, roofHeight, d), roofMat);
        garageRoof.position.set(cx, h + roofHeight / 2 + groundY, cz);
        garageRoof.castShadow = true; 
        garageRoof.receiveShadow = true;
        this.building.add(garageRoof);

        // Gutters around garage roof
        const gutterMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const gutterGeom = new THREE.BoxGeometry(w * 0.05, roofHeight * 0.3, d * 0.05);
        
        const frontGutter = new THREE.Mesh(gutterGeom, gutterMat);
        frontGutter.position.set(cx, h + roofHeight + groundY, cz + d / 2 + 0.1);
        this.building.add(frontGutter);

        const backGutter = new THREE.Mesh(gutterGeom, gutterMat);
        backGutter.position.set(cx, h + roofHeight + groundY, cz - d / 2 - 0.1);
        this.building.add(backGutter);
    }

    addUKWindowsCasement(w, d, h, floorH, cx, groundY) {
        const whiteMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95 
        });
        const glassMat = new THREE.MeshPhongMaterial({ 
            color: 0x87ceeb, 
            transparent: true, 
            opacity: 0.7, 
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });

        const addWindow = (x, y, z, windowW, windowH) => {
            // Window frame
            const frame = new THREE.Mesh(new THREE.BoxGeometry(windowW, windowH, 0.05), whiteMat);
            frame.position.set(x, y, z + 0.07);
            frame.castShadow = true;
            this.building.add(frame);
            
            // Window glass
            const pane = new THREE.Mesh(new THREE.PlaneGeometry(windowW * 0.9, windowH * 0.9), glassMat);
            pane.position.set(x, y, z + 0.09);
            this.building.add(pane);
            
            // Window sill
            const sill = new THREE.Mesh(new THREE.BoxGeometry(windowW * 1.2, 0.1, 0.2), whiteMat);
            sill.position.set(x, y - windowH / 2 - 0.05, z + 0.11);
            sill.castShadow = true;
            this.building.add(sill);
        };

        const windowW = w * 0.15;
        const windowH = floorH * 0.6;

        // Ground floor windows
        addWindow(cx + w * 0.25, groundY + floorH * 0.5, d / 2 + 0.01, windowW, windowH);
        addWindow(cx + w * 0.45, groundY + floorH * 0.5, d / 2 + 0.01, windowW, windowH);

        // First floor windows
        addWindow(cx - w * 0.2, groundY + floorH * 1.5, d / 2 + 0.01, windowW, windowH);
        addWindow(cx + w * 0.2, groundY + floorH * 1.5, d / 2 + 0.01, windowW, windowH);
        addWindow(cx + w * 0.4, groundY + floorH * 1.5, d / 2 + 0.01, windowW, windowH);
    }

    addUKBlueDoors(garageW, garageH, garageD, cx, cz, groundY) {
        const blueMat = new THREE.MeshPhongMaterial({ 
            color: 0x1e3a8a, // Better blue color
            transparent: true, 
            opacity: 0.95 
        });
        const whiteMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95 
        });

        // Garage door
        const gDoor = new THREE.Mesh(new THREE.BoxGeometry(garageW * 0.9, garageH * 0.9, 0.08), blueMat);
        gDoor.position.set(cx, groundY + garageH * 0.5, cz + garageD / 2 + 0.08);
        gDoor.castShadow = true;
        this.building.add(gDoor);
        
        // Garage door frame
        const gFrame = new THREE.Mesh(new THREE.BoxGeometry(garageW, garageH, 0.04), whiteMat);
        gFrame.position.set(cx, groundY + garageH * 0.5, cz + garageD / 2 + 0.06);
        this.building.add(gFrame);

        // Front door on main house (not garage)
        const doorW = 0.8;
        const doorH = 2.0;
        const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.06), blueMat);
        door.position.set(cx - garageW * 0.5, groundY + doorH / 2, cz + garageD / 2 + 0.06);
        door.castShadow = true;
        this.building.add(door);
        
        // Front door frame
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.1, doorH * 1.1, 0.03), whiteMat);
        doorFrame.position.copy(door.position);
        this.building.add(doorFrame);

        // Door handle
        const handle = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), whiteMat);
        handle.position.set(cx - garageW * 0.5 + doorW * 0.3, groundY + doorH / 2, cz + garageD / 2 + 0.1);
        this.building.add(handle);
    }

    addUKWhiteTrims(w, d, h, cx, groundY) {
        const whiteMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95 
        });

        // Lintels above windows
        const lintel1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.1, 0.1), whiteMat);
        lintel1.position.set(cx + w * 0.35, groundY + 1.0, d / 2 + 0.05);
        this.building.add(lintel1);

        const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.1, 0.1), whiteMat);
        lintel2.position.set(cx, groundY + 2.0, d / 2 + 0.05);
        this.building.add(lintel2);
    }

    addUKDetails(houseW, houseD, houseH, garageW, garageH, garageD, groundY) {
        // Chimney
        const chimneyGeom = new THREE.BoxGeometry(houseW * 0.08, houseH * 0.3, houseD * 0.08);
        const brickMat = new THREE.MeshPhongMaterial({ 
            color: 0xd4a574, 
            transparent: true, 
            opacity: 0.95 
        });
        const chimney = new THREE.Mesh(chimneyGeom, brickMat);
        chimney.position.set(houseW * 0.4, houseH + houseH * 0.15 + groundY, houseD * 0.3);
        chimney.castShadow = true;
        this.building.add(chimney);

        // Gutters
        const gutterMat = new THREE.MeshPhongMaterial({ 
            color: 0x2f2f2f, 
            transparent: true, 
            opacity: 0.9 
        });
        
        const frontGutter = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, houseW * 1.2, 8), gutterMat);
        frontGutter.position.set(houseW * 0.15, houseH + 0.1 + groundY, houseD / 2 + 0.1);
        frontGutter.rotation.z = Math.PI / 2;
        this.building.add(frontGutter);

        const backGutter = frontGutter.clone();
        backGutter.position.z = -houseD / 2 - 0.1;
        this.building.add(backGutter);
    }

    // British House Types
    createTownhouse(floors, width, depth, height, floorHeight, features) {
        // Main structure - typical British townhouse proportions
        const mainGeometry = new THREE.BoxGeometry(width, height, depth);
        const mainMaterial = new THREE.MeshPhongMaterial({
            color: 0x8B4513, // Brick red
            transparent: true,
            opacity: 0.95
        });
        const mainBuilding = new THREE.Mesh(mainGeometry, mainMaterial);
        mainBuilding.position.y = height / 2;
        mainBuilding.castShadow = true;
        mainBuilding.receiveShadow = true;
        this.building.add(mainBuilding);

        // Add foundation
        this.addFoundation(width, depth);

        // Add brick exterior walls
        this.addBrickWalls(width, depth, height, floorHeight);

        // Traditional sash windows
        if (features.windows) {
            this.addSashWindows(width, depth, height, floors, floorHeight);
        }

        // Traditional front door with steps
        this.addTraditionalDoor(width, depth, floorHeight);

        // Traditional pitched roof
        if (features.roof) {
            this.addPitchedRoof(width, depth, height);
        }
        
        // Small balconies on upper floors
        if (features.balconies) {
            this.addTownhouseBalconies(width, depth, height, floors, floorHeight);
        }
        
        // Traditional lighting
        if (features.lighting) {
            this.addTraditionalLighting(width, depth, height, floors, floorHeight);
        }

        // Add traditional architectural details
        this.addTownhouseDetails(width, depth, height, floors, floorHeight);
    }

    createTerraceHouse(floors, width, depth, height, floorHeight, features) {
        // Main structure - narrow terrace house
        const mainGeometry = new THREE.BoxGeometry(width, height, depth);
        const mainMaterial = new THREE.MeshPhongMaterial({
            color: 0x8B4513, // Brick red
            transparent: true,
            opacity: 0.95
        });
        const mainBuilding = new THREE.Mesh(mainGeometry, mainMaterial);
        mainBuilding.position.y = height / 2;
        mainBuilding.castShadow = true;
        mainBuilding.receiveShadow = true;
        this.building.add(mainBuilding);

        // Add foundation
        this.addFoundation(width, depth);

        // Add brick exterior walls
        this.addBrickWalls(width, depth, height, floorHeight);

        // Bay windows and sash windows
        if (features.windows) {
            this.addBayWindows(width, depth, height, floors, floorHeight);
        }

        // Traditional front door with steps
        this.addTraditionalDoor(width, depth, floorHeight);

        // Traditional pitched roof
        if (features.roof) {
            this.addPitchedRoof(width, depth, height);
        }
        
        // Small balconies
        if (features.balconies) {
            this.addTerraceBalconies(width, depth, height, floors, floorHeight);
        }
        
        // Traditional lighting
        if (features.lighting) {
            this.addTraditionalLighting(width, depth, height, floors, floorHeight);
        }

        // Add terrace house details
        this.addTerraceDetails(width, depth, height, floors, floorHeight);
    }

    // British House Components
    addBrickWalls(width, depth, height, floorHeight) {
        // Front wall with brick texture
        const frontWallGeometry = new THREE.BoxGeometry(width, height, 0.2);
        const frontWallMaterial = new THREE.MeshPhongMaterial({
            color: 0x8B4513,
            transparent: true,
            opacity: 0.9
        });
        const frontWall = new THREE.Mesh(frontWallGeometry, frontWallMaterial);
        frontWall.position.set(0, height / 2, depth / 2 + 0.1);
        frontWall.castShadow = true;
        this.building.add(frontWall);

        // Back wall
        const backWall = frontWall.clone();
        backWall.position.z = -depth / 2 - 0.1;
        this.building.add(backWall);

        // Side walls
        const sideWallGeometry = new THREE.BoxGeometry(0.2, height, depth);
        const sideWallMaterial = new THREE.MeshPhongMaterial({
            color: 0x8B4513,
            transparent: true,
            opacity: 0.9
        });
        
        const leftWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
        leftWall.position.set(-width / 2 - 0.1, height / 2, 0);
        leftWall.castShadow = true;
        this.building.add(leftWall);

        const rightWall = leftWall.clone();
        rightWall.position.x = width / 2 + 0.1;
        this.building.add(rightWall);
    }

    addSashWindows(width, depth, height, floors, floorHeight) {
        for (let i = 0; i < floors; i++) {
            // Front sash windows
            for (let j = 0; j < 2; j++) {
                const windowWidth = width * 0.3;
                const windowHeight = floorHeight * 0.7;
                
                // Window frame
                const frameGeometry = new THREE.BoxGeometry(windowWidth + 0.1, windowHeight + 0.1, 0.05);
                const frameMaterial = new THREE.MeshPhongMaterial({
                    color: 0x8B4513,
                    transparent: true,
                    opacity: 0.9
                });
                const frame = new THREE.Mesh(frameGeometry, frameMaterial);
                frame.position.set(
                    (j - 0.5) * width * 0.6,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.15
                );
                frame.castShadow = true;
                this.building.add(frame);

                // Window glass
                const glassGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight);
                const glassMaterial = new THREE.MeshPhongMaterial({
                    color: 0x87ceeb,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });
                const glass = new THREE.Mesh(glassGeometry, glassMaterial);
                glass.position.set(
                    (j - 0.5) * width * 0.6,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.175
                );
                this.building.add(glass);

                // Window sill
                const sillGeometry = new THREE.BoxGeometry(windowWidth + 0.2, 0.1, 0.2);
                const sillMaterial = new THREE.MeshPhongMaterial({
                    color: 0x696969,
                    transparent: true,
                    opacity: 0.9
                });
                const sill = new THREE.Mesh(sillGeometry, sillMaterial);
                sill.position.set(
                    (j - 0.5) * width * 0.6,
                    i * floorHeight + floorHeight / 2 - windowHeight / 2 - 0.05,
                    depth / 2 + 0.2
                );
                sill.castShadow = true;
                this.building.add(sill);
            }

            // Side windows
            const sideWindowWidth = depth * 0.6;
            const sideWindowHeight = floorHeight * 0.7;
            
            // Side window frame
            const sideFrameGeometry = new THREE.BoxGeometry(0.05, sideWindowHeight + 0.1, sideWindowWidth + 0.1);
            const sideFrameMaterial = new THREE.MeshPhongMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.9
            });
            const sideFrame = new THREE.Mesh(sideFrameGeometry, sideFrameMaterial);
            sideFrame.position.set(width / 2 + 0.15, i * floorHeight + floorHeight / 2, 0);
            sideFrame.castShadow = true;
            this.building.add(sideFrame);

            // Side window glass
            const sideGlassGeometry = new THREE.PlaneGeometry(sideWindowWidth, sideWindowHeight);
            const sideGlassMaterial = new THREE.MeshPhongMaterial({
                color: 0x87ceeb,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            const sideGlass = new THREE.Mesh(sideGlassGeometry, sideGlassMaterial);
            sideGlass.position.set(width / 2 + 0.175, i * floorHeight + floorHeight / 2, 0);
            sideGlass.rotation.y = Math.PI / 2;
            this.building.add(sideGlass);
        }
    }

    addBayWindows(width, depth, height, floors, floorHeight) {
        for (let i = 0; i < floors; i++) {
            // Bay window on front
            const bayWidth = width * 0.4;
            const bayDepth = depth * 0.2;
            const bayHeight = floorHeight * 0.7;
            
            // Bay window structure
            const bayGeometry = new THREE.BoxGeometry(bayWidth, bayHeight, bayDepth);
            const bayMaterial = new THREE.MeshPhongMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.9
            });
            const bay = new THREE.Mesh(bayGeometry, bayMaterial);
            bay.position.set(0, i * floorHeight + floorHeight / 2, depth / 2 + bayDepth / 2 + 0.1);
            bay.castShadow = true;
            this.building.add(bay);

            // Bay window glass
            const bayGlassGeometry = new THREE.PlaneGeometry(bayWidth * 0.8, bayHeight * 0.8);
            const bayGlassMaterial = new THREE.MeshPhongMaterial({
                color: 0x87ceeb,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            const bayGlass = new THREE.Mesh(bayGlassGeometry, bayGlassMaterial);
            bayGlass.position.set(0, i * floorHeight + floorHeight / 2, depth / 2 + bayDepth + 0.15);
            this.building.add(bayGlass);

            // Regular sash windows on sides
            for (let j = 0; j < 2; j++) {
                const windowWidth = width * 0.25;
                const windowHeight = floorHeight * 0.6;
                
                const frameGeometry = new THREE.BoxGeometry(windowWidth + 0.1, windowHeight + 0.1, 0.05);
                const frameMaterial = new THREE.MeshPhongMaterial({
                    color: 0x8B4513,
                    transparent: true,
                    opacity: 0.9
                });
                const frame = new THREE.Mesh(frameGeometry, frameMaterial);
                frame.position.set(
                    (j - 0.5) * width * 0.7,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.15
                );
                frame.castShadow = true;
                this.building.add(frame);

                const glassGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight);
                const glassMaterial = new THREE.MeshPhongMaterial({
                    color: 0x87ceeb,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });
                const glass = new THREE.Mesh(glassGeometry, glassMaterial);
                glass.position.set(
                    (j - 0.5) * width * 0.7,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.175
                );
                this.building.add(glass);
            }
        }
    }

    addTraditionalDoor(width, depth, floorHeight) {
        // Front door with steps
        const doorWidth = width * 0.25;
        const doorHeight = floorHeight * 0.8;
        
        // Door frame
        const doorFrameGeometry = new THREE.BoxGeometry(doorWidth + 0.1, doorHeight + 0.1, 0.05);
        const doorFrameMaterial = new THREE.MeshPhongMaterial({
            color: 0x8B4513,
            transparent: true,
            opacity: 0.9
        });
        const doorFrame = new THREE.Mesh(doorFrameGeometry, doorFrameMaterial);
        doorFrame.position.set(0, floorHeight / 2, depth / 2 + 0.15);
        doorFrame.castShadow = true;
        this.building.add(doorFrame);

        // Door
        const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.1);
        const doorMaterial = new THREE.MeshPhongMaterial({
            color: 0x654321,
            transparent: true,
            opacity: 0.9
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, floorHeight / 2, depth / 2 + 0.175);
        door.castShadow = true;
        this.building.add(door);

        // Door handle
        const handleGeometry = new THREE.SphereGeometry(0.02, 8, 6);
        const handleMaterial = new THREE.MeshPhongMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0.9
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(doorWidth * 0.3, floorHeight / 2, depth / 2 + 0.2);
        this.building.add(handle);

        // Front steps
        for (let i = 0; i < 3; i++) {
            const stepGeometry = new THREE.BoxGeometry(doorWidth + 0.4, 0.15, 0.3);
            const stepMaterial = new THREE.MeshPhongMaterial({
                color: 0x696969,
                transparent: true,
                opacity: 0.9
            });
            const step = new THREE.Mesh(stepGeometry, stepMaterial);
            step.position.set(0, i * 0.15, depth / 2 + 0.3 + i * 0.3);
            step.castShadow = true;
            this.building.add(step);
        }
    }

    addPitchedRoof(width, depth, height) {
        // Traditional pitched roof
        const roofGeometry = new THREE.ConeGeometry(width * 0.7, height * 0.3, 4);
        const roofMaterial = new THREE.MeshPhongMaterial({
            color: 0x2F4F4F, // Dark slate
            transparent: true,
            opacity: 0.9
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, height + height * 0.15, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        this.building.add(roof);

        // Chimney
        const chimneyGeometry = new THREE.BoxGeometry(width * 0.1, height * 0.2, depth * 0.1);
        const chimneyMaterial = new THREE.MeshPhongMaterial({
            color: 0x8B4513,
            transparent: true,
            opacity: 0.9
        });
        const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
        chimney.position.set(width * 0.3, height + height * 0.1, depth * 0.3);
        chimney.castShadow = true;
        this.building.add(chimney);
    }

    addTownhouseBalconies(width, depth, height, floors, floorHeight) {
        for (let i = 1; i < floors; i++) {
            const balconyGeometry = new THREE.BoxGeometry(width * 0.6, 0.1, depth * 0.2);
            const balconyMaterial = new THREE.MeshPhongMaterial({
                color: 0x696969,
                transparent: true,
                opacity: 0.9
            });
            const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
            balcony.position.set(0, i * floorHeight + floorHeight / 2, depth / 2 + depth * 0.1);
            balcony.castShadow = true;
            this.building.add(balcony);

            // Balcony railing
            const railingGeometry = new THREE.BoxGeometry(width * 0.6, floorHeight * 0.2, 0.05);
            const railingMaterial = new THREE.MeshPhongMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.8
            });
            const railing = new THREE.Mesh(railingGeometry, railingMaterial);
            railing.position.set(0, i * floorHeight + floorHeight / 2 + floorHeight * 0.1, depth / 2 + depth * 0.15);
            this.building.add(railing);
        }
    }

    addTerraceBalconies(width, depth, height, floors, floorHeight) {
        for (let i = 1; i < floors; i++) {
            const balconyGeometry = new THREE.BoxGeometry(width * 0.4, 0.1, depth * 0.15);
            const balconyMaterial = new THREE.MeshPhongMaterial({
                color: 0x696969,
                transparent: true,
                opacity: 0.9
            });
            const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
            balcony.position.set(0, i * floorHeight + floorHeight / 2, depth / 2 + depth * 0.08);
            balcony.castShadow = true;
            this.building.add(balcony);

            // Balcony railing
            const railingGeometry = new THREE.BoxGeometry(width * 0.4, floorHeight * 0.15, 0.05);
            const railingMaterial = new THREE.MeshPhongMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.8
            });
            const railing = new THREE.Mesh(railingGeometry, railingMaterial);
            railing.position.set(0, i * floorHeight + floorHeight / 2 + floorHeight * 0.08, depth / 2 + depth * 0.12);
            this.building.add(railing);
        }
    }

    addTraditionalLighting(width, depth, height, floors, floorHeight) {
        // Traditional wall lights
        for (let i = 0; i < floors; i++) {
            const lightGeometry = new THREE.SphereGeometry(width * 0.03, 8, 6);
            const lightMaterial = new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 0.8
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(width * 0.4, i * floorHeight + floorHeight / 2, depth / 2 + 0.1);
            this.building.add(light);
        }
    }

    addTownhouseDetails(width, depth, height, floors, floorHeight) {
        // Traditional corner columns
        for (let i = 0; i < 4; i++) {
            const columnGeometry = new THREE.CylinderGeometry(width * 0.04, width * 0.04, height, 8);
            const columnMaterial = new THREE.MeshPhongMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.9
            });
            const column = new THREE.Mesh(columnGeometry, columnMaterial);
            
            const angle = (i * Math.PI) / 2;
            column.position.set(
                Math.cos(angle) * (width / 2 + 0.1),
                height / 2,
                Math.sin(angle) * (depth / 2 + 0.1)
            );
            column.castShadow = true;
            this.building.add(column);
        }

        // Traditional gutters
        const gutterGeometry = new THREE.CylinderGeometry(width * 0.02, width * 0.02, width * 1.1, 8);
        const gutterMaterial = new THREE.MeshPhongMaterial({
            color: 0x2F4F4F,
            transparent: true,
            opacity: 0.9
        });
        
        const frontGutter = new THREE.Mesh(gutterGeometry, gutterMaterial);
        frontGutter.position.set(0, height + 0.1, depth / 2 + 0.1);
        frontGutter.rotation.z = Math.PI / 2;
        this.building.add(frontGutter);

        const backGutter = frontGutter.clone();
        backGutter.position.z = -depth / 2 - 0.1;
        this.building.add(backGutter);
    }

    addTerraceDetails(width, depth, height, floors, floorHeight) {
        // Terrace house specific details
        for (let i = 0; i < 2; i++) {
            const columnGeometry = new THREE.CylinderGeometry(width * 0.03, width * 0.03, height, 8);
            const columnMaterial = new THREE.MeshPhongMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.9
            });
            const column = new THREE.Mesh(columnGeometry, columnMaterial);
            
            column.position.set(
                (i === 0 ? -1 : 1) * (width / 2 + 0.1),
                height / 2,
                0
            );
            column.castShadow = true;
            this.building.add(column);
        }

        // Traditional gutters
        const gutterGeometry = new THREE.CylinderGeometry(width * 0.02, width * 0.02, width * 1.1, 8);
        const gutterMaterial = new THREE.MeshPhongMaterial({
            color: 0x2F4F4F,
            transparent: true,
            opacity: 0.9
        });
        
        const frontGutter = new THREE.Mesh(gutterGeometry, gutterMaterial);
        frontGutter.position.set(0, height + 0.1, depth / 2 + 0.1);
        frontGutter.rotation.z = Math.PI / 2;
        this.building.add(frontGutter);

        const backGutter = frontGutter.clone();
        backGutter.position.z = -depth / 2 - 0.1;
        this.building.add(backGutter);
    }

    // Detailed Building Components
    addFoundation(width, depth) {
        const foundationGeometry = new THREE.BoxGeometry(width * 1.1, 0.5, depth * 1.1);
        const foundationMaterial = new THREE.MeshPhongMaterial({
            color: 0x2a2a2a,
            transparent: true,
            opacity: 0.95,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
        foundation.position.set(0, -0.26, 0);
        foundation.castShadow = true;
        foundation.receiveShadow = true;
        this.building.add(foundation);
    }

    addExteriorWalls(width, depth, height, floorHeight) {
        // Front wall with texture
        const frontWallGeometry = new THREE.BoxGeometry(width, height, 0.2);
        const frontWallMaterial = new THREE.MeshPhongMaterial({
            color: 0x4a4a5e,
            transparent: true,
            opacity: 0.9
        });
        const frontWall = new THREE.Mesh(frontWallGeometry, frontWallMaterial);
        frontWall.position.set(0, height / 2, depth / 2 + 0.1);
        frontWall.castShadow = true;
        this.building.add(frontWall);

        // Back wall
        const backWall = frontWall.clone();
        backWall.position.z = -depth / 2 - 0.1;
        this.building.add(backWall);

        // Side walls
        const sideWallGeometry = new THREE.BoxGeometry(0.2, height, depth);
        const sideWallMaterial = new THREE.MeshPhongMaterial({
            color: 0x4a4a5e,
            transparent: true,
            opacity: 0.9
        });
        
        const leftWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
        leftWall.position.set(-width / 2 - 0.1, height / 2, 0);
        leftWall.castShadow = true;
        this.building.add(leftWall);

        const rightWall = leftWall.clone();
        rightWall.position.x = width / 2 + 0.1;
        this.building.add(rightWall);
    }

    addModernWindows(width, depth, height, floors, floorHeight) {
        for (let i = 0; i < floors; i++) {
            // Front windows with detailed frames
            for (let j = 0; j < 3; j++) {
                const windowWidth = width * 0.25;
                const windowHeight = floorHeight * 0.6;
                
                // Window frame
                const frameGeometry = new THREE.BoxGeometry(windowWidth + 0.1, windowHeight + 0.1, 0.05);
                const frameMaterial = new THREE.MeshPhongMaterial({
                    color: 0x8b4513,
                    transparent: true,
                    opacity: 0.9
                });
                const frame = new THREE.Mesh(frameGeometry, frameMaterial);
                frame.position.set(
                    (j - 1) * width * 0.3,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.15
                );
                frame.castShadow = true;
                this.building.add(frame);

                // Window glass
                const glassGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight);
                const glassMaterial = new THREE.MeshPhongMaterial({
                    color: 0x87ceeb,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });
                const glass = new THREE.Mesh(glassGeometry, glassMaterial);
                glass.position.set(
                    (j - 1) * width * 0.3,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.175
                );
                this.building.add(glass);

                // Window sill
                const sillGeometry = new THREE.BoxGeometry(windowWidth + 0.2, 0.1, 0.2);
                const sillMaterial = new THREE.MeshPhongMaterial({
                    color: 0x696969,
                    transparent: true,
                    opacity: 0.9
                });
                const sill = new THREE.Mesh(sillGeometry, sillMaterial);
                sill.position.set(
                    (j - 1) * width * 0.3,
                    i * floorHeight + floorHeight / 2 - windowHeight / 2 - 0.05,
                    depth / 2 + 0.2
                );
                sill.castShadow = true;
                this.building.add(sill);
            }

            // Side windows
            const sideWindowWidth = depth * 0.8;
            const sideWindowHeight = floorHeight * 0.6;
            
            // Side window frame
            const sideFrameGeometry = new THREE.BoxGeometry(0.05, sideWindowHeight + 0.1, sideWindowWidth + 0.1);
            const sideFrameMaterial = new THREE.MeshPhongMaterial({
                color: 0x8b4513,
                transparent: true,
                opacity: 0.9
            });
            const sideFrame = new THREE.Mesh(sideFrameGeometry, sideFrameMaterial);
            sideFrame.position.set(width / 2 + 0.15, i * floorHeight + floorHeight / 2, 0);
            sideFrame.castShadow = true;
            this.building.add(sideFrame);

            // Side window glass
            const sideGlassGeometry = new THREE.PlaneGeometry(sideWindowWidth, sideWindowHeight);
            const sideGlassMaterial = new THREE.MeshPhongMaterial({
                color: 0x87ceeb,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            const sideGlass = new THREE.Mesh(sideGlassGeometry, sideGlassMaterial);
            sideGlass.position.set(width / 2 + 0.175, i * floorHeight + floorHeight / 2, 0);
            sideGlass.rotation.y = Math.PI / 2;
            this.building.add(sideGlass);
        }
    }

    addDoors(width, depth, floorHeight) {
        // Main entrance door
        const doorWidth = width * 0.2;
        const doorHeight = floorHeight * 0.8;
        
        // Door frame
        const doorFrameGeometry = new THREE.BoxGeometry(doorWidth + 0.1, doorHeight + 0.1, 0.05);
        const doorFrameMaterial = new THREE.MeshPhongMaterial({
            color: 0x8b4513,
            transparent: true,
            opacity: 0.9
        });
        const doorFrame = new THREE.Mesh(doorFrameGeometry, doorFrameMaterial);
        doorFrame.position.set(0, floorHeight / 2, depth / 2 + 0.15);
        doorFrame.castShadow = true;
        this.building.add(doorFrame);

        // Door
        const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.1);
        const doorMaterial = new THREE.MeshPhongMaterial({
            color: 0x654321,
            transparent: true,
            opacity: 0.9
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, floorHeight / 2, depth / 2 + 0.175);
        door.castShadow = true;
        this.building.add(door);

        // Door handle
        const handleGeometry = new THREE.SphereGeometry(0.02, 8, 6);
        const handleMaterial = new THREE.MeshPhongMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0.9
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(doorWidth * 0.3, floorHeight / 2, depth / 2 + 0.2);
        this.building.add(handle);
    }

    addArchitecturalDetails(width, depth, height, floors, floorHeight) {
        // Corner columns
        for (let i = 0; i < 4; i++) {
            const columnGeometry = new THREE.CylinderGeometry(width * 0.05, width * 0.05, height, 8);
            const columnMaterial = new THREE.MeshPhongMaterial({
                color: 0x696969,
                transparent: true,
                opacity: 0.9
            });
            const column = new THREE.Mesh(columnGeometry, columnMaterial);
            
            const angle = (i * Math.PI) / 2;
            column.position.set(
                Math.cos(angle) * (width / 2 + 0.1),
                height / 2,
                Math.sin(angle) * (depth / 2 + 0.1)
            );
            column.castShadow = true;
            this.building.add(column);
        }

        // Floor separators
        for (let i = 1; i < floors; i++) {
            const separatorGeometry = new THREE.BoxGeometry(width * 1.1, 0.1, depth * 1.1);
            const separatorMaterial = new THREE.MeshPhongMaterial({
                color: 0x5a5a5a,
                transparent: true,
                opacity: 0.8
            });
            const separator = new THREE.Mesh(separatorGeometry, separatorMaterial);
            separator.position.set(0, i * floorHeight, 0);
            separator.castShadow = true;
            this.building.add(separator);
        }

        // Gutters
        const gutterGeometry = new THREE.CylinderGeometry(width * 0.02, width * 0.02, width * 1.1, 8);
        const gutterMaterial = new THREE.MeshPhongMaterial({
            color: 0x2f4f4f,
            transparent: true,
            opacity: 0.9
        });
        
        const frontGutter = new THREE.Mesh(gutterGeometry, gutterMaterial);
        frontGutter.position.set(0, height + 0.1, depth / 2 + 0.1);
        frontGutter.rotation.z = Math.PI / 2;
        this.building.add(frontGutter);

        const backGutter = frontGutter.clone();
        backGutter.position.z = -depth / 2 - 0.1;
        this.building.add(backGutter);
    }

    // Cyberpunk Building Components
    addCyberpunkWalls(width, depth, height, floorHeight) {
        // Front wall with cyberpunk texture
        const frontWallGeometry = new THREE.BoxGeometry(width, height, 0.2);
        const frontWallMaterial = new THREE.MeshPhongMaterial({
            color: 0x3a1a4e,
            transparent: true,
            opacity: 0.9
        });
        const frontWall = new THREE.Mesh(frontWallGeometry, frontWallMaterial);
        frontWall.position.set(0, height / 2, depth / 2 + 0.1);
        frontWall.castShadow = true;
        this.building.add(frontWall);

        // Back wall
        const backWall = frontWall.clone();
        backWall.position.z = -depth / 2 - 0.1;
        this.building.add(backWall);

        // Side walls
        const sideWallGeometry = new THREE.BoxGeometry(0.2, height, depth);
        const sideWallMaterial = new THREE.MeshPhongMaterial({
            color: 0x3a1a4e,
            transparent: true,
            opacity: 0.9
        });
        
        const leftWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
        leftWall.position.set(-width / 2 - 0.1, height / 2, 0);
        leftWall.castShadow = true;
        this.building.add(leftWall);

        const rightWall = leftWall.clone();
        rightWall.position.x = width / 2 + 0.1;
        this.building.add(rightWall);
    }

    addCyberpunkWindows(width, depth, height, floors, floorHeight, features) {
        for (let i = 0; i < floors; i++) {
            // Front windows with neon frames
            for (let j = 0; j < 2; j++) {
                const windowWidth = width * 0.3;
                const windowHeight = floorHeight * 0.5;
                
                // Window frame
                const frameGeometry = new THREE.BoxGeometry(windowWidth + 0.1, windowHeight + 0.1, 0.05);
                const frameMaterial = new THREE.MeshPhongMaterial({
                    color: 0x1a1a1a,
                    transparent: true,
                    opacity: 0.9
                });
                const frame = new THREE.Mesh(frameGeometry, frameMaterial);
                frame.position.set(
                    (j - 0.5) * width * 0.6,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.15
                );
                frame.castShadow = true;
                this.building.add(frame);

                // Window glass
                const glassGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight);
                const glassMaterial = new THREE.MeshPhongMaterial({
                    color: 0x00ff88,
                    transparent: true,
                    opacity: 0.4,
                    side: THREE.DoubleSide
                });
                const glass = new THREE.Mesh(glassGeometry, glassMaterial);
                glass.position.set(
                    (j - 0.5) * width * 0.6,
                    i * floorHeight + floorHeight / 2,
                    depth / 2 + 0.175
                );
                this.building.add(glass);

                // Neon frame
                if (features.neonFrames) {
                    const neonFrameGeometry = new THREE.BoxGeometry(windowWidth + 0.15, windowHeight + 0.15, 0.02);
                    const neonFrameMaterial = new THREE.MeshBasicMaterial({
                        color: 0xff0080,
                        transparent: true,
                        opacity: 0.8
                    });
                    const neonFrame = new THREE.Mesh(neonFrameGeometry, neonFrameMaterial);
                    neonFrame.position.set(
                        (j - 0.5) * width * 0.6,
                        i * floorHeight + floorHeight / 2,
                        depth / 2 + 0.19
                    );
                    this.building.add(neonFrame);
                }
            }
        }
    }

    addCyberpunkDoors(width, depth, floorHeight) {
        // Main entrance door
        const doorWidth = width * 0.25;
        const doorHeight = floorHeight * 0.8;
        
        // Door frame
        const doorFrameGeometry = new THREE.BoxGeometry(doorWidth + 0.1, doorHeight + 0.1, 0.05);
        const doorFrameMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            transparent: true,
            opacity: 0.9
        });
        const doorFrame = new THREE.Mesh(doorFrameGeometry, doorFrameMaterial);
        doorFrame.position.set(0, floorHeight / 2, depth / 2 + 0.15);
        doorFrame.castShadow = true;
        this.building.add(doorFrame);

        // Door
        const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.1);
        const doorMaterial = new THREE.MeshPhongMaterial({
            color: 0x2a1a3e,
            transparent: true,
            opacity: 0.9
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, floorHeight / 2, depth / 2 + 0.175);
        door.castShadow = true;
        this.building.add(door);

        // Cyberpunk door panel
        const panelGeometry = new THREE.BoxGeometry(doorWidth * 0.8, doorHeight * 0.6, 0.02);
        const panelMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.7
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.set(0, floorHeight / 2, depth / 2 + 0.2);
        this.building.add(panel);

        // Door handle
        const handleGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8);
        const handleMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0080,
            transparent: true,
            opacity: 0.9
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(doorWidth * 0.3, floorHeight / 2, depth / 2 + 0.2);
        handle.rotation.z = Math.PI / 2;
        this.building.add(handle);
    }

    addCyberpunkDetails(width, depth, height, floors, floorHeight) {
        // Cyberpunk corner pillars
        for (let i = 0; i < 4; i++) {
            const pillarGeometry = new THREE.CylinderGeometry(width * 0.06, width * 0.08, height, 8);
            const pillarMaterial = new THREE.MeshPhongMaterial({
                color: 0x1a1a1a,
                transparent: true,
                opacity: 0.9
            });
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            
            const angle = (i * Math.PI) / 2;
            pillar.position.set(
                Math.cos(angle) * (width / 2 + 0.1),
                height / 2,
                Math.sin(angle) * (depth / 2 + 0.1)
            );
            pillar.castShadow = true;
            this.building.add(pillar);

            // Neon accent on pillar
            const accentGeometry = new THREE.CylinderGeometry(width * 0.07, width * 0.07, height * 0.1, 8);
            const accentMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0080,
                transparent: true,
                opacity: 0.8
            });
            const accent = new THREE.Mesh(accentGeometry, accentMaterial);
            accent.position.set(
                Math.cos(angle) * (width / 2 + 0.1),
                height * 0.8,
                Math.sin(angle) * (depth / 2 + 0.1)
            );
            this.building.add(accent);
        }

        // Tech floor separators
        for (let i = 1; i < floors; i++) {
            const separatorGeometry = new THREE.BoxGeometry(width * 1.1, 0.1, depth * 1.1);
            const separatorMaterial = new THREE.MeshPhongMaterial({
                color: 0x3a1a4e,
                transparent: true,
                opacity: 0.8
            });
            const separator = new THREE.Mesh(separatorGeometry, separatorMaterial);
            separator.position.set(0, i * floorHeight, 0);
            separator.castShadow = true;
            this.building.add(separator);

            // Neon strip on separator
            const stripGeometry = new THREE.BoxGeometry(width * 1.0, 0.02, depth * 1.0);
            const stripMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.9
            });
            const strip = new THREE.Mesh(stripGeometry, stripMaterial);
            strip.position.set(0, i * floorHeight + 0.06, 0);
            this.building.add(strip);
        }

        // Cyberpunk gutters
        const gutterGeometry = new THREE.CylinderGeometry(width * 0.03, width * 0.03, width * 1.1, 8);
        const gutterMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            transparent: true,
            opacity: 0.9
        });
        
        const frontGutter = new THREE.Mesh(gutterGeometry, gutterMaterial);
        frontGutter.position.set(0, height + 0.1, depth / 2 + 0.1);
        frontGutter.rotation.z = Math.PI / 2;
        this.building.add(frontGutter);

        const backGutter = frontGutter.clone();
        backGutter.position.z = -depth / 2 - 0.1;
        this.building.add(backGutter);
    }

    updateInfoPanel(width, depth, height, floorHeight) {
        document.getElementById('height-value').textContent = `${height.toFixed(1)}m`;
        document.getElementById('width-value').textContent = `${width.toFixed(1)}m`;
        document.getElementById('depth-value').textContent = `${depth.toFixed(1)}m`;
        document.getElementById('floor-height-value').textContent = `${floorHeight.toFixed(1)}m`;
    }

    showLoading(show) {
        const overlay = document.querySelector('.scene-overlay');
        if (!overlay) return;
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    generateInitialBuilding() {
        if (!this.designerEnabled) return;
        const floorsEl = document.getElementById('floors');
        const volumeEl = document.getElementById('volume');
        const surfaceAreaEl = document.getElementById('surface-area');
        const styleEl = document.getElementById('building-style');
        if (!floorsEl || !volumeEl || !surfaceAreaEl || !styleEl) return;

        const floors = parseInt(floorsEl.value);
        const houseType = (document.getElementById('house-type') || { value: 'house' }).value;
        const volume = parseInt(volumeEl.value);
        const surfaceArea = parseInt(surfaceAreaEl.value);
        const style = styleEl.value;
        
        // Force floors = 1 for bungalow
        const effectiveFloors = houseType === 'bungalow' ? 1 : floors;

        this.generateBuilding(effectiveFloors, volume, surfaceArea, style);

        // Extension after main build
        const showExtension = (document.getElementById('show-extension') || { checked: false }).checked;
        if (showExtension) {
            const extLength = parseInt((document.getElementById('extension-length') || { value: 6 }).value);
            const extWidth = parseInt((document.getElementById('extension-width') || { value: 4 }).value);
            const extFloors = parseInt((document.getElementById('extension-floors') || { value: 1 }).value);
            const extSide = (document.getElementById('extension-position') || { value: 'right' }).value;
            this.addExtension(extSide, extLength, extWidth, extFloors);
        }
    }

    initHeroAnimation() {
        // Disabled per user request (remove hero 3D preview)
        return;
    }

    createFloatingShapes() {
        // Remove floating shapes for professional look
        return;
    }

    getRandomGeometry() {
        // Remove random geometries for professional look
        return;
    }

    animateHero() {
        // Remove hero animation for professional look
        return;
    }

    setupNavigation() {
        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Mobile menu toggle
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
        }

        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });

        // Keep navbar transparent (remove forced dark background on scroll)
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            if (!navbar) return;
            navbar.style.background = 'transparent';
            navbar.style.borderBottom = '1px solid transparent';
        });

        // Contact form handling
        const contactForm = document.querySelector('.contact-form');
        if (contactForm) {
            const hasAction = !!contactForm.getAttribute('action');
            if (!hasAction) {
                contactForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleContactForm(e.target);
                });
            }
        }
    }

    initRevealObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    handleContactForm(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Show success message (in a real app, you'd send this to a server)
        alert('Thank you for your message! We\'ll get back to you soon.');
        form.reset();
    }

    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    setupEventListeners() {
        // Slider event listeners
        const floorsSlider = document.getElementById('floors');
        const volumeSlider = document.getElementById('volume');
        const surfaceAreaSlider = document.getElementById('surface-area');
        const styleSelect = document.getElementById('building-style');
        const houseType = document.getElementById('house-type');
        const showExtension = document.getElementById('show-extension');
        const extensionPosition = document.getElementById('extension-position');
        const extensionLength = document.getElementById('extension-length');
        const extensionWidth = document.getElementById('extension-width');
        const extensionFloors = document.getElementById('extension-floors');
        const generateBtn = document.getElementById('generate-btn');
        const estimateBtn = document.getElementById('estimate-btn');

        floorsSlider?.addEventListener('input', (e) => {
            document.getElementById('floors-value').textContent = e.target.value;
        });

        volumeSlider?.addEventListener('input', (e) => {
            document.getElementById('volume-value').textContent = parseInt(e.target.value).toLocaleString();
        });

        surfaceAreaSlider?.addEventListener('input', (e) => {
            document.getElementById('surface-area-value').textContent = parseInt(e.target.value).toLocaleString();
        });

        // Extension sliders display
        const updateExtDisplays = () => {
            const el = document.getElementById('extension-length');
            if (el) document.getElementById('extension-length-value').textContent = el.value;
            const ew = document.getElementById('extension-width');
            if (ew) document.getElementById('extension-width-value').textContent = ew.value;
            const ef = document.getElementById('extension-floors');
            if (ef) document.getElementById('extension-floors-value').textContent = ef.value;
        };
        updateExtDisplays();
        extensionLength?.addEventListener('input', updateExtDisplays);
        extensionWidth?.addEventListener('input', updateExtDisplays);
        extensionFloors?.addEventListener('input', updateExtDisplays);

        // Generate button
        generateBtn?.addEventListener('click', () => {
            this.generateInitialBuilding();
        });

        // Estimate button
        if (estimateBtn) {
            estimateBtn.addEventListener('click', () => {
                this.calculateEstimate();
            });
        }

        // Auto-generate on slider change
        [floorsSlider, volumeSlider, surfaceAreaSlider, styleSelect, houseType, showExtension, extensionPosition, extensionLength, extensionWidth, extensionFloors]
            .filter(Boolean)
            .forEach(element => {
                element.addEventListener('change', () => {
                    this.generateInitialBuilding();
                });
            });

        // Auto-generate on feature toggle change
        const featureToggles = document.querySelectorAll('.feature-toggle input[type="checkbox"]');
        featureToggles.forEach(toggle => {
            toggle.addEventListener('change', () => {
                this.generateInitialBuilding();
            });
        });

        // Also listen to structure layer toggles
        ['show-slabs','show-walls','show-columns','show-beams','show-plates'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    // Toggle visibility on current building without full rebuild when possible
                    if (!this.building) { this.generateInitialBuilding(); return; }
                    const features = this.getFeatureToggles();
                    this.building.traverse((obj) => {
                        if (!(obj instanceof THREE.Mesh)) return;
                        const layer = obj.userData.layer;
                        if (layer === 'slab') obj.visible = !!features.slabs;
                        if (layer === 'wall') obj.visible = !!features.walls;
                        if (layer === 'column') obj.visible = !!features.columns;
                        if (layer === 'beam') obj.visible = !!features.beams;
                        if (layer === 'plate') obj.visible = !!features.plates;
                    });
                });
            }
        });
    }

    calculateEstimate() {
        const type = (document.getElementById('est-type') || { value: 'single' }).value;
        const quality = (document.getElementById('est-quality') || { value: 'standard' }).value;
        const length = parseFloat((document.getElementById('est-length') || { value: 6 }).value) || 0;
        const width = parseFloat((document.getElementById('est-width') || { value: 4 }).value) || 0;
        const height = parseFloat((document.getElementById('est-height') || { value: 2.4 }).value) || 2.4;
        const location = (document.getElementById('est-location') || { value: 'uk-average' }).value;

        // Base costs per m2
        let basePerM2 = 1350; // lowered GBP
        if (type === 'double') basePerM2 = 1250; // economies on per-floor
        if (type === 'loft') basePerM2 = 1200;
        if (type === 'garage') basePerM2 = 700;

        // Quality multiplier
        let qualityMult = 1.0;
        if (quality === 'premium') qualityMult = 1.15;
        if (quality === 'luxury') qualityMult = 1.3;

        // Location multiplier
        let locationMult = 1.0;
        if (location === 'uk-london') locationMult = 1.15; // reduced
        if (location === 'uk-north') locationMult = 0.9;

        // Area and floors
        const area = Math.max(0, length) * Math.max(0, width);
        const floors = (type === 'double') ? 2 : 1;
        const totalArea = area * floors;

        // Height adjustment (taller ceilings increase cost)
        const heightMult = Math.min(1.15, Math.max(1.0, height / 2.4)); // cap

        const estimate = Math.round(totalArea * basePerM2 * qualityMult * locationMult * heightMult);
        const out = document.getElementById('estimate-output');
        if (out) out.textContent = 'Build: £' + estimate.toLocaleString();

        // Drawings-only estimate: base fixed bands + area component
        let drawingsBase = 650; // starting point
        if (type === 'double') drawingsBase = 950;
        if (type === 'loft') drawingsBase = 800;
        if (type === 'garage') drawingsBase = 500;
        const drawingsArea = Math.max(0, totalArea) * 8; // £/m2 small add
        const drawingsEstimateA = Math.round(drawingsBase + drawingsArea);
        const drawingsEstimateB = Math.round(drawingsEstimateA * 1.3);
        const drawingsEstimateC = Math.round(drawingsEstimateA * 3);
        const outA = document.getElementById('estimate-drawings-A');
        const outB = document.getElementById('estimate-drawings-B');
        const outC = document.getElementById('estimate-drawings-C');
        if (outA) outA.textContent = 'Plan A: £' + drawingsEstimateA.toLocaleString();
        if (outB) outB.textContent = 'Plan B: £' + drawingsEstimateB.toLocaleString();
        if (outC) outC.textContent = 'Plan C: £' + drawingsEstimateC.toLocaleString();
    }

    addFloorPlanPorches(w, d, h, cx, groundY) {
        const porchMat = new THREE.MeshPhongMaterial({ 
            color: 0x8B4513, // Brown porch color
            transparent: true, 
            opacity: 0.9 
        });

        // Upper covered porch (17'-4" x 8')
        const upperPorchGeom = new THREE.BoxGeometry(17.33, 0.2, 8);
        const upperPorch = new THREE.Mesh(upperPorchGeom, porchMat);
        upperPorch.position.set(cx, groundY + 0.1, d / 2 + 4);
        upperPorch.castShadow = true;
        upperPorch.receiveShadow = true;
        this.building.add(upperPorch);

        // Lower-left covered porch (14'-8" x 5')
        const lowerPorchGeom = new THREE.BoxGeometry(14.67, 0.2, 5);
        const lowerPorch = new THREE.Mesh(lowerPorchGeom, porchMat);
        lowerPorch.position.set(cx - w * 0.2, groundY + 0.1, -d / 2 - 2.5);
        lowerPorch.castShadow = true;
        lowerPorch.receiveShadow = true;
        this.building.add(lowerPorch);

        // Porch supports
        const supportMat = new THREE.MeshPhongMaterial({ color: 0x654321 });
        for (let i = 0; i < 4; i++) {
            const supportGeom = new THREE.BoxGeometry(0.2, h * 0.8, 0.2);
            const support = new THREE.Mesh(supportGeom, supportMat);
            support.position.set(cx + (i - 1.5) * 4, h * 0.4 + groundY, d / 2 + 4);
            support.castShadow = true;
            this.building.add(support);
        }
    }

    addFloorPlanRoof(w, d, h, cx, groundY) {
        const roofMat = new THREE.MeshPhongMaterial({ 
            color: 0x4a4a4a, // Dark roof tiles
            transparent: true, 
            opacity: 0.95 
        });

        // Main house roof
        const roofHeight = h * 0.3;
        const mainRoofGeom = new THREE.BoxGeometry(w, roofHeight, d);
        const mainRoof = new THREE.Mesh(mainRoofGeom, roofMat);
        mainRoof.position.set(cx, h + roofHeight / 2 + groundY, 0);
        mainRoof.castShadow = true; 
        mainRoof.receiveShadow = true;
        this.building.add(mainRoof);

        // Chimney
        const chimneyGeom = new THREE.BoxGeometry(2, roofHeight * 1.5, 1.5);
        const chimneyMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const chimney = new THREE.Mesh(chimneyGeom, chimneyMat);
        chimney.position.set(cx + w * 0.2, h + roofHeight * 1.2 + groundY, d / 2 - 2);
        chimney.castShadow = true;
        this.building.add(chimney);
    }

    addFloorPlanGarageRoof(w, d, h, cx, cz, groundY) {
        const roofMat = new THREE.MeshPhongMaterial({ 
            color: 0x4a4a4a, // Dark roof tiles
            transparent: true, 
            opacity: 0.95 
        });
        
        const garageRoof = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.2, d), roofMat);
        garageRoof.position.set(cx, h + h * 0.1 + groundY, cz);
        garageRoof.castShadow = true; 
        garageRoof.receiveShadow = true;
        this.building.add(garageRoof);
    }

    addFloorPlanWindows(w, d, h, cx, groundY) {
        const whiteMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95 
        });
        const glassMat = new THREE.MeshPhongMaterial({ 
            color: 0x87CEEB, 
            transparent: true, 
            opacity: 0.7 
        });

        // Front windows (Great Room)
        const frontWindowGeom = new THREE.BoxGeometry(3, 4, 0.1);
        const frontWindow = new THREE.Mesh(frontWindowGeom, glassMat);
        frontWindow.position.set(cx + w * 0.1, h * 0.6 + groundY, d / 2 + 0.12);
        frontWindow.castShadow = true;
        this.building.add(frontWindow);

        // Front window frame
        const frontFrameGeom = new THREE.BoxGeometry(3.2, 4.2, 0.05);
        const frontFrame = new THREE.Mesh(frontFrameGeom, whiteMat);
        frontFrame.position.set(cx + w * 0.1, h * 0.6 + groundY, d / 2 + 0.13);
        this.building.add(frontFrame);

        // Side windows
        const sideWindowGeom = new THREE.BoxGeometry(0.1, 4, 3);
        const sideWindow = new THREE.Mesh(sideWindowGeom, glassMat);
        sideWindow.position.set(cx - w / 2 - 0.12, h * 0.6 + groundY, 0);
        sideWindow.castShadow = true;
        this.building.add(sideWindow);

        // Side window frame
        const sideFrameGeom = new THREE.BoxGeometry(0.05, 4.2, 3.2);
        const sideFrame = new THREE.Mesh(sideFrameGeom, whiteMat);
        sideFrame.position.set(cx - w / 2 - 0.14, h * 0.6 + groundY, 0);
        this.building.add(sideFrame);

        // Master bedroom window
        const masterWindowGeom = new THREE.BoxGeometry(3, 3, 0.1);
        const masterWindow = new THREE.Mesh(masterWindowGeom, glassMat);
        masterWindow.position.set(cx + w * 0.4, h * 0.5 + groundY, d / 2 + 0.12);
        masterWindow.castShadow = true;
        this.building.add(masterWindow);

        // Master window frame
        const masterFrameGeom = new THREE.BoxGeometry(3.2, 3.2, 0.05);
        const masterFrame = new THREE.Mesh(masterFrameGeom, whiteMat);
        masterFrame.position.set(cx + w * 0.4, h * 0.5 + groundY, d / 2 + 0.13);
        this.building.add(masterFrame);
    }

    addFloorPlanDoors(garageW, garageH, garageD, cx, cz, groundY) {
        const blueMat = new THREE.MeshPhongMaterial({ 
            color: 0x1e3a8a, // Blue doors
            transparent: true, 
            opacity: 0.95 
        });
        const whiteMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95 
        });

        // Two-car garage doors
        const garageDoorGeom = new THREE.BoxGeometry(garageW * 0.9, garageH * 0.9, 0.08);
        const garageDoor = new THREE.Mesh(garageDoorGeom, blueMat);
        garageDoor.position.set(cx, groundY + garageH * 0.5, cz + garageD / 2 + 0.08);
        garageDoor.castShadow = true;
        this.building.add(garageDoor);
        
        // Garage door frame
        const garageFrameGeom = new THREE.BoxGeometry(garageW, garageH, 0.04);
        const garageFrame = new THREE.Mesh(garageFrameGeom, whiteMat);
        garageFrame.position.set(cx, groundY + garageH * 0.5, cz + garageD / 2 + 0.06);
        this.building.add(garageFrame);

        // Front door (Entry)
        const frontDoorGeom = new THREE.BoxGeometry(0.8, 2.2, 0.06);
        const frontDoor = new THREE.Mesh(frontDoorGeom, blueMat);
        frontDoor.position.set(cx - garageW * 0.3, groundY + 1.1, cz + garageD / 2 + 0.06);
        frontDoor.castShadow = true;
        this.building.add(frontDoor);
        
        // Front door frame
        const frontDoorFrameGeom = new THREE.BoxGeometry(0.9, 2.3, 0.03);
        const frontDoorFrame = new THREE.Mesh(frontDoorFrameGeom, whiteMat);
        frontDoorFrame.position.copy(frontDoor.position);
        this.building.add(frontDoorFrame);

        // Door handle
        const handle = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), whiteMat);
        handle.position.set(cx - garageW * 0.3 + 0.3, groundY + 1.1, cz + garageD / 2 + 0.1);
        this.building.add(handle);
    }

    addFloorPlanInterior(w, d, h, cx, groundY) {
        // Interior walls to show room divisions
        const wallMat = new THREE.MeshPhongMaterial({ 
            color: 0xf5f5f5, // Light gray interior walls
            transparent: true, 
            opacity: 0.8 
        });

        // Great Room to Kitchen wall
        const kitchenWallGeom = new THREE.BoxGeometry(0.1, h * 0.8, 8);
        const kitchenWall = new THREE.Mesh(kitchenWallGeom, wallMat);
        kitchenWall.position.set(cx + w * 0.15, h * 0.4 + groundY, -d * 0.1);
        this.building.add(kitchenWall);

        // Master bedroom wall
        const masterWallGeom = new THREE.BoxGeometry(0.1, h * 0.8, 12);
        const masterWall = new THREE.Mesh(masterWallGeom, wallMat);
        masterWall.position.set(cx + w * 0.35, h * 0.4 + groundY, d * 0.2);
        this.building.add(masterWall);

        // Bedroom wing walls
        const bedroomWallGeom = new THREE.BoxGeometry(0.1, h * 0.8, 15);
        const bedroomWall = new THREE.Mesh(bedroomWallGeom, wallMat);
        bedroomWall.position.set(cx - w * 0.25, h * 0.4 + groundY, 0);
        this.building.add(bedroomWall);

        // Fireplace in Great Room
        const fireplaceGeom = new THREE.BoxGeometry(3, h * 0.6, 1);
        const fireplaceMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const fireplace = new THREE.Mesh(fireplaceGeom, fireplaceMat);
        fireplace.position.set(cx + w * 0.2, h * 0.3 + groundY, d / 2 - 0.5);
        fireplace.castShadow = true;
        this.building.add(fireplace);
    }

    addFloorPlanDetails(w, d, h, garageW, garageH, garageD, groundY) {
        const whiteMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95 
        });

        // Gutters
        const gutterMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const gutterGeom = new THREE.BoxGeometry(w * 0.05, h * 0.1, d * 0.05);
        
        const frontGutter = new THREE.Mesh(gutterGeom, gutterMat);
        frontGutter.position.set(w * 0.3, h + h * 0.15 + groundY, d / 2 + 0.1);
        this.building.add(frontGutter);

        const backGutter = new THREE.Mesh(gutterGeom, gutterMat);
        backGutter.position.set(w * 0.3, h + h * 0.15 + groundY, -d / 2 - 0.1);
        this.building.add(backGutter);

        // Garage gutters
        const garageGutterGeom = new THREE.BoxGeometry(garageW * 0.05, garageH * 0.1, garageD * 0.05);
        const garageGutter = new THREE.Mesh(garageGutterGeom, gutterMat);
        garageGutter.position.set(w * 0.7 + garageW * 0.5, garageH + garageH * 0.1 + groundY, garageD / 2 + 0.1);
        this.building.add(garageGutter);
    }

    // Structured block builder: creates slab, walls, columns, beams as separate meshes
    addBlockStructure(key, cx, cz, groundY, w, d, h, opts = {}) {
        if (!this.buildingParts[key]) this.buildingParts[key] = new THREE.Group();
        const group = this.buildingParts[key];
        group.position.set(cx, 0, cz);

        const baseColor = opts.color || 0xd4a574;

        // Slab
        const slabMat = new THREE.MeshPhongMaterial({ color: 0x6b6b6b, transparent: true, opacity: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), slabMat);
        slab.position.set(0, groundY + 0.15, 0);
        slab.receiveShadow = true;
        slab.userData.layer = 'slab';
        group.add(slab);

        // Perimeter walls (shell)
        const wallMat = new THREE.MeshPhongMaterial({ color: baseColor, transparent: true, opacity: 0.95 });
        const wallThickness = 0.25;
        const wallH = h;
        const frontWall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, wallThickness), wallMat);
        frontWall.position.set(0, groundY + wallH / 2, d / 2 + wallThickness / 2);
        const backWall = frontWall.clone();
        backWall.position.z = -d / 2 - wallThickness / 2;
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallH, d), wallMat);
        leftWall.position.set(-w / 2 - wallThickness / 2, groundY + wallH / 2, 0);
        const rightWall = leftWall.clone();
        rightWall.position.x = w / 2 + wallThickness / 2;
        [frontWall, backWall, leftWall, rightWall].forEach(wm => { wm.userData.layer = 'wall'; });
        group.add(frontWall, backWall, leftWall, rightWall);

        // Columns at corners
        const colMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        const col = new THREE.CylinderGeometry(0.2, 0.2, h, 12);
        const corners = [
            [-w / 2, d / 2],
            [w / 2, d / 2],
            [-w / 2, -d / 2],
            [w / 2, -d / 2]
        ];
        corners.forEach(([x, z]) => {
            const c = new THREE.Mesh(col, colMat);
            c.position.set(x, groundY + h / 2, z);
            c.castShadow = true;
            c.userData.layer = 'column';
            group.add(c);
        });

        // Perimeter beam
        const beamMat = new THREE.MeshPhongMaterial({ color: 0x8b7d6b, transparent: true, opacity: 0.95 });
        const beamY = groundY + h + 0.15;
        const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.2), beamMat);
        frontBeam.position.set(0, beamY, d / 2 + 0.1);
        const backBeam = frontBeam.clone();
        backBeam.position.z = -d / 2 - 0.1;
        const leftBeam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, d), beamMat);
        leftBeam.position.set(-w / 2 - 0.1, beamY, 0);
        const rightBeam = leftBeam.clone();
        rightBeam.position.x = w / 2 + 0.1;
        [frontBeam, backBeam, leftBeam, rightBeam].forEach(b => { b.userData.layer = 'beam'; });
        group.add(frontBeam, backBeam, leftBeam, rightBeam);

        // Roof plate (thin) — leave actual roof feature to existing functions
        const plateMat = new THREE.MeshPhongMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.7, depthWrite: false });
        const plate = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.1, d - 0.2), plateMat);
        plate.position.set(0, beamY + 0.1, 0);
        plate.userData.layer = 'plate';
        group.add(plate);

        // Add to building
        this.building.add(group);

        // Apply current layer visibility
        const features = this.getFeatureToggles();
        group.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            const layer = obj.userData.layer;
            if (layer === 'slab') obj.visible = !!features.slabs;
            if (layer === 'wall') obj.visible = !!features.walls;
            if (layer === 'column') obj.visible = !!features.columns;
            if (layer === 'beam') obj.visible = !!features.beams;
            if (layer === 'plate') obj.visible = !!features.plates;
        });
    }

    addConnectingWalls(coreW, coreD, coreH, masterW, masterD, masterH, garageW, garageD, garageH, groundY, houseMat) {
        // Wall connecting core to left wing
        const leftWallGeom = new THREE.BoxGeometry(0.2, coreH * 0.8, coreD * 0.6);
        const leftWall = new THREE.Mesh(leftWallGeom, houseMat);
        leftWall.position.set(-coreW * 0.2, coreH * 0.4 + groundY, 0);
        leftWall.castShadow = true;
        this.building.add(leftWall);

        // Wall connecting core to master wing
        const masterWallGeom = new THREE.BoxGeometry(0.2, masterH * 0.8, masterD * 0.8);
        const masterWall = new THREE.Mesh(masterWallGeom, houseMat);
        masterWall.position.set(coreW * 0.2, masterH * 0.4 + groundY, coreD * 0.1);
        masterWall.castShadow = true;
        this.building.add(masterWall);

        // Wall connecting master wing to garage
        const garageWallGeom = new THREE.BoxGeometry(0.2, garageH * 0.8, garageD * 0.8);
        const garageWall = new THREE.Mesh(garageWallGeom, houseMat);
        garageWall.position.set(coreW * 0.2 + masterW, garageH * 0.4 + groundY, -coreD * 0.05);
        garageWall.castShadow = true;
        this.building.add(garageWall);
    }

    addFloorPlanWingRoof(w, d, h, cx, cz, groundY) {
        const roofMat = new THREE.MeshPhongMaterial({ 
            color: 0x4a4a4a, // Dark roof tiles
            transparent: true, 
            opacity: 0.95 
        });
        
        const wingRoof = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.25, d), roofMat);
        wingRoof.position.set(cx, h + h * 0.125 + groundY, cz || 0);
        wingRoof.castShadow = true; 
        wingRoof.receiveShadow = true;
        this.building.add(wingRoof);
    }

    addFloorPlanWingWindows(w, d, h, cx, cz, groundY) {
        const whiteMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.95 
        });
        const glassMat = new THREE.MeshPhongMaterial({ 
            color: 0x87CEEB, 
            transparent: true, 
            opacity: 0.7 
        });

        // Windows for wing sections
        const windowGeom = new THREE.BoxGeometry(2.5, 3, 0.1);
        const window = new THREE.Mesh(windowGeom, glassMat);
        window.position.set(cx, h * 0.5 + groundY, (cz || 0) + d / 2 + 0.1);
        window.castShadow = true;
        this.building.add(window);

        // Window frame
        const frameGeom = new THREE.BoxGeometry(2.7, 3.2, 0.05);
        const frame = new THREE.Mesh(frameGeom, whiteMat);
        frame.position.set(cx, h * 0.5 + groundY, (cz || 0) + d / 2 + 0.12);
        this.building.add(frame);
    }

    onWindowResize() {
        const canvas = document.getElementById('canvas');
        this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        
        // Hero animation removed for professional look
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        
        // Building stays stationary
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Theme: derive colors from the logo and update CSS variables
function applyThemeFromLogo() {
    const logoImage = document.querySelector('.logo-image');
    if (!logoImage) return;
    // 1) Respect explicit brand overrides if present
    const explicitPrimary = getExplicitBrandColor('--brand-primary', logoImage.dataset.brandPrimary);
    const explicitSecondary = getExplicitBrandColor('--brand-secondary', logoImage.dataset.brandSecondary);
    const explicitAccent = getExplicitBrandColor('--brand-accent', logoImage.dataset.brandAccent);

    if (explicitPrimary) {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', explicitPrimary);
        if (explicitSecondary) root.style.setProperty('--secondary-color', explicitSecondary);
        if (explicitAccent) root.style.setProperty('--accent-color', explicitAccent);
        const gradTo = explicitSecondary || explicitPrimary;
        root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${explicitPrimary}, ${gradTo})`);
        return; // done
    }
    if (logoImage.complete && logoImage.naturalWidth > 0) {
        setThemeFromLogoImage(logoImage);
    } else {
        logoImage.addEventListener('load', () => setThemeFromLogoImage(logoImage), { once: true });
    }
}

function setThemeFromLogoImage(imageEl) {
    try {
        const color = extractDominantColorByHue(imageEl);
        const primaryHex = rgbToHex(color.r, color.g, color.b);
        const palette = buildPaletteFromPrimary(color.r, color.g, color.b);
        const root = document.documentElement;
        root.style.setProperty('--primary-color', primaryHex);
        root.style.setProperty('--secondary-color', palette.secondaryHex);
        root.style.setProperty('--accent-color', palette.accentHex);
        root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${primaryHex}, ${palette.secondaryHex})`);
    } catch (_) {
        // If extraction fails, silently keep existing theme
    }
}

function getExplicitBrandColor(cssVarName, dataValue) {
    // Prefer data-* attribute explicit value first
    if (dataValue && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(dataValue)) return dataValue;
    // Then check computed CSS variable on :root
    const style = getComputedStyle(document.documentElement);
    const value = style.getPropertyValue(cssVarName).trim();
    if (value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return value;
    return '';
}

function extractDominantColor(imageEl) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const targetSize = 80;
    const width = Math.max(1, Math.min(targetSize, imageEl.naturalWidth || targetSize));
    const height = Math.max(1, Math.min(targetSize, imageEl.naturalHeight || targetSize));
    canvas.width = width;
    canvas.height = height;
    context.drawImage(imageEl, 0, 0, width, height);

    const { data } = context.getImageData(0, 0, width, height);
    let sumR = 0, sumG = 0, sumB = 0, weightSum = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 10) continue; // skip fully transparent

        // Compute luma (perceived brightness)
        const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        // Skip near-white and near-black pixels likely from backgrounds
        if (luma > 0.94 || luma < 0.06) continue;

        // Skip near-gray pixels (low chroma)
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (maxC - minC < 18) continue;

        // Weight more saturated colors slightly higher
        const { s } = rgbToHsl(r, g, b);
        const weight = 0.7 + 0.6 * s; // 0.7..1.3

        sumR += r * weight;
        sumG += g * weight;
        sumB += b * weight;
        weightSum += weight;
    }

    if (weightSum === 0) {
        // Fallback to simple average of all pixels
        for (let i = 0; i < data.length; i += 4) {
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
        }
        const count = data.length / 4;
        return { r: Math.round(sumR / count), g: Math.round(sumG / count), b: Math.round(sumB / count) };
    }

    return {
        r: Math.round(sumR / weightSum),
        g: Math.round(sumG / weightSum),
        b: Math.round(sumB / weightSum)
    };
}

// Improved extraction: build a hue histogram and select the strongest non-neutral hue
function extractDominantColorByHue(imageEl) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const targetSize = 120;
    const width = Math.max(1, Math.min(targetSize, imageEl.naturalWidth || targetSize));
    const height = Math.max(1, Math.min(targetSize, imageEl.naturalHeight || targetSize));
    canvas.width = width;
    canvas.height = height;
    context.drawImage(imageEl, 0, 0, width, height);

    const { data } = context.getImageData(0, 0, width, height);
    const bins = 36; // 10° per bin
    const hueWeights = new Array(bins).fill(0);
    const hueSamples = new Array(bins).fill(0).map(() => ({ r: 0, g: 0, b: 0, w: 0 }));

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 10) continue;

        // Skip near-white/near-black and near-gray
        const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        if (luma > 0.95 || luma < 0.05) continue;
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const chroma = maxC - minC;
        if (chroma < 15) continue;

        const { h, s } = rgbToHsl(r, g, b);
        // weight by saturation and inverse distance from mid-lightness
        const weight = Math.max(0.0001, s) * (0.4 + 0.6 * (1 - Math.abs((luma - 0.5) * 2))); // favor mid-tones
        const bin = Math.min(bins - 1, Math.max(0, Math.floor((h / 360) * bins)));
        hueWeights[bin] += weight;
        hueSamples[bin].r += r * weight;
        hueSamples[bin].g += g * weight;
        hueSamples[bin].b += b * weight;
        hueSamples[bin].w += weight;
    }

    // Find the strongest hue bin
    let bestIdx = -1, bestW = 0;
    for (let i = 0; i < bins; i++) {
        if (hueWeights[i] > bestW) { bestW = hueWeights[i]; bestIdx = i; }
    }

    if (bestIdx === -1 || hueSamples[bestIdx].w === 0) {
        return extractDominantColor(imageEl); // fallback to previous approach
    }

    const s = hueSamples[bestIdx];
    return {
        r: Math.round(s.r / s.w),
        g: Math.round(s.g / s.w),
        b: Math.round(s.b / s.w)
    };
}

function buildPaletteFromPrimary(r, g, b) {
    const { h, s, l } = rgbToHsl(r, g, b);
    // Secondary: slightly lighter and a touch less saturated for UI balance
    const secondary = hslToRgb(h, clamp01(s * 0.85), clamp01(l * 1.15));
    // Accent: slightly darker and more saturated for contrast elements
    const accent = hslToRgb(h, clamp01(s * 1.05), clamp01(l * 0.9));
    return {
        secondaryHex: rgbToHex(secondary.r, secondary.g, secondary.b),
        accentHex: rgbToHex(accent.r, accent.g, accent.b)
    };
}

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

function rgbToHex(r, g, b) {
    const toHex = (v) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case r: h = ((g - b) / d) % 6; break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if (0 <= h && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (60 <= h && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (120 <= h && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (180 <= h && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (240 <= h && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
    };
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BuildingGenerator();
    initThemeSwitcher();
    // Only apply auto-logo theme if no saved theme
    const saved = localStorage.getItem('site-theme');
    if (!saved || saved === 'auto') {
        applyThemeFromLogo();
    }
    removeWhiteLogoBackgrounds();
});

function removeWhiteLogoBackgrounds() {
    const logos = Array.from(document.querySelectorAll('img.logo-image[data-remove-bg="white"]'));
    logos.forEach((img) => {
        if (img.complete && img.naturalWidth > 0) {
            processImageToTransparent(img);
        } else {
            img.addEventListener('load', () => processImageToTransparent(img), { once: true });
        }
    });
}

function processImageToTransparent(img) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Sample corners to estimate background color (assumed white-ish)
        const bg = averageColors([
            samplePixel(data, w, 0, 0),
            samplePixel(data, w, w - 1, 0),
            samplePixel(data, w, 0, h - 1),
            samplePixel(data, w, w - 1, h - 1)
        ]);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            // Distance to background, treat near-white/near-bg as transparent
            const dist = colorDistance(r, g, b, bg.r, bg.g, bg.b);
            const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b);
            const isNearWhite = luma > 240; // almost white
            if (dist < 30 || isNearWhite) {
                data[i + 3] = 0; // transparent
            }
        }

        ctx.putImageData(imageData, 0, 0);
        // Swap the image source to a PNG data URL with transparency
        img.src = canvas.toDataURL('image/png');
        img.style.mixBlendMode = 'normal';
    } catch (_) {
        // ignore failures; keep original image
    }
}

function samplePixel(data, width, x, y) {
    const idx = (y * width + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

function averageColors(colors) {
    const total = colors.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });
    const n = colors.length || 1;
    return { r: Math.round(total.r / n), g: Math.round(total.g / n), b: Math.round(total.b / n) };
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function initThemeSwitcher() {
    const saved = localStorage.getItem('site-theme');
    if (saved) {
        applyThemePreset(saved);
    }

    document.querySelectorAll('.btn-mini[data-theme]').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-theme');
            if (preset === 'auto') {
                localStorage.removeItem('site-theme');
                applyThemeFromLogo();
                return;
            }
            applyThemePreset(preset);
            if (preset === 'reset') {
                localStorage.removeItem('site-theme');
            } else {
                localStorage.setItem('site-theme', preset);
            }
        });
    });

    // Style mode switcher
    const savedStyle = localStorage.getItem('site-style');
    if (savedStyle) {
        document.documentElement.setAttribute('data-style', savedStyle);
    } else {
        document.documentElement.setAttribute('data-style', 'fresh');
    }
    document.querySelectorAll('.btn-mini[data-style]').forEach(btn => {
        btn.addEventListener('click', () => {
            const style = btn.getAttribute('data-style');
            document.documentElement.setAttribute('data-style', style);
            localStorage.setItem('site-style', style);
        });
    });

    // Custom color picker
    const picker = document.getElementById('themeColorPicker');
    if (picker) {
        const savedCustom = localStorage.getItem('site-theme-custom');
        if (savedCustom) picker.value = savedCustom;
        picker.addEventListener('input', (e) => {
            const hex = e.target.value;
            applyCustomPrimary(hex);
            localStorage.setItem('site-theme', 'custom');
            localStorage.setItem('site-theme-custom', hex);
        });
    }
}

function applyThemePreset(preset) {
    const root = document.documentElement;
    switch ((preset || '').toLowerCase()) {
        case 'light':
            root.style.setProperty('--brand-primary', '#2388ff');
            root.style.setProperty('--brand-secondary', '#186ac6');
            root.style.setProperty('--brand-accent', '#94a3b8');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f5f7fb');
            root.style.setProperty('--bg-tertiary', '#eef2f7');
            root.style.setProperty('--bg-accent', '#f0f6ff');
            root.style.setProperty('--text-primary', '#0b1220');
            root.style.setProperty('--text-secondary', '#334155');
            break;
        case 'blue':
            root.style.setProperty('--brand-primary', '#0f62fe');
            root.style.setProperty('--brand-secondary', '#0043ce');
            root.style.setProperty('--brand-accent', '#a8c5ff');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f3f6ff');
            root.style.setProperty('--bg-tertiary', '#e8efff');
            root.style.setProperty('--bg-accent', '#eef3ff');
            root.style.setProperty('--text-primary', '#0b1220');
            root.style.setProperty('--text-secondary', '#334155');
            break;
        case 'grey':
            root.style.setProperty('--brand-primary', '#4b5563');
            root.style.setProperty('--brand-secondary', '#374151');
            root.style.setProperty('--brand-accent', '#94a3b8');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f7f7f9');
            root.style.setProperty('--bg-tertiary', '#f0f2f5');
            root.style.setProperty('--bg-accent', '#f5f7fa');
            root.style.setProperty('--text-primary', '#111827');
            root.style.setProperty('--text-secondary', '#4b5563');
            break;
        case 'dark':
            root.style.setProperty('--brand-primary', '#2388ff');
            root.style.setProperty('--brand-secondary', '#186ac6');
            root.style.setProperty('--brand-accent', '#9fb3c8');
            root.style.setProperty('--bg-primary', '#0b1220');
            root.style.setProperty('--bg-secondary', '#0e1626');
            root.style.setProperty('--bg-tertiary', '#0f1a2e');
            root.style.setProperty('--bg-accent', '#0a2236');
            root.style.setProperty('--text-primary', '#e5f2ff');
            root.style.setProperty('--text-secondary', '#c1d5e7');
            break;
        case 'teal':
            root.style.setProperty('--brand-primary', '#14b8a6');
            root.style.setProperty('--brand-secondary', '#0d9488');
            root.style.setProperty('--brand-accent', '#99f6e4');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f3fbfa');
            root.style.setProperty('--bg-tertiary', '#e7f7f4');
            root.style.setProperty('--bg-accent', '#effcfb');
            root.style.setProperty('--text-primary', '#0b1220');
            root.style.setProperty('--text-secondary', '#334155');
            break;
        case 'purple':
            root.style.setProperty('--brand-primary', '#8b5cf6');
            root.style.setProperty('--brand-secondary', '#6d28d9');
            root.style.setProperty('--brand-accent', '#ddd6fe');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f7f4ff');
            root.style.setProperty('--bg-tertiary', '#efe9ff');
            root.style.setProperty('--bg-accent', '#f4efff');
            root.style.setProperty('--text-primary', '#0b1220');
            root.style.setProperty('--text-secondary', '#334155');
            break;
        case 'green':
            root.style.setProperty('--brand-primary', '#22c55e');
            root.style.setProperty('--brand-secondary', '#16a34a');
            root.style.setProperty('--brand-accent', '#bbf7d0');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f4fbf6');
            root.style.setProperty('--bg-tertiary', '#e9f7ec');
            root.style.setProperty('--bg-accent', '#effcf3');
            root.style.setProperty('--text-primary', '#0b1220');
            root.style.setProperty('--text-secondary', '#334155');
            break;
        case 'amber':
            root.style.setProperty('--brand-primary', '#f59e0b');
            root.style.setProperty('--brand-secondary', '#d97706');
            root.style.setProperty('--brand-accent', '#fde68a');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#fff9f0');
            root.style.setProperty('--bg-tertiary', '#fff3e0');
            root.style.setProperty('--bg-accent', '#fff7ea');
            root.style.setProperty('--text-primary', '#0b1220');
            root.style.setProperty('--text-secondary', '#334155');
            break;
        case 'mono':
            root.style.setProperty('--brand-primary', '#475569');
            root.style.setProperty('--brand-secondary', '#334155');
            root.style.setProperty('--brand-accent', '#94a3b8');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f6f7f9');
            root.style.setProperty('--bg-tertiary', '#eef1f4');
            root.style.setProperty('--bg-accent', '#f3f5f8');
            root.style.setProperty('--text-primary', '#0b1220');
            root.style.setProperty('--text-secondary', '#475569');
            break;
        case 'contrast':
            root.style.setProperty('--brand-primary', '#000000');
            root.style.setProperty('--brand-secondary', '#111111');
            root.style.setProperty('--brand-accent', '#333333');
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#ffffff');
            root.style.setProperty('--bg-tertiary', '#ffffff');
            root.style.setProperty('--bg-accent', '#ffffff');
            root.style.setProperty('--text-primary', '#000000');
            root.style.setProperty('--text-secondary', '#111111');
            break;
        case 'reset':
            // Clear inline theme overrides to fall back to CSS defaults
            ['--brand-primary','--brand-secondary','--brand-accent','--primary-color','--secondary-color','--accent-color','--bg-primary','--bg-secondary','--bg-tertiary','--bg-accent','--text-primary','--text-secondary','--gradient-primary','--gradient-secondary'].forEach(v => root.style.removeProperty(v));
            return;
        default:
            // fall back to current variables; support 'custom'
            if (preset === 'custom') {
                const hex = localStorage.getItem('site-theme-custom') || '#2388ff';
                applyCustomPrimary(hex);
            }
            return;
    }
    // Map brand to theme vars
    root.style.setProperty('--primary-color', getComputedStyle(root).getPropertyValue('--brand-primary').trim());
    root.style.setProperty('--secondary-color', getComputedStyle(root).getPropertyValue('--brand-secondary').trim());
    root.style.setProperty('--accent-color', getComputedStyle(root).getPropertyValue('--brand-accent').trim());
    // Refresh gradients
    const primary = getComputedStyle(root).getPropertyValue('--primary-color').trim();
    const secondary = getComputedStyle(root).getPropertyValue('--secondary-color').trim();
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${primary}1a, ${primary})`);
    root.style.setProperty('--gradient-secondary', `linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))`);
}

function applyCustomPrimary(hex) {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', hex);
    // Derive secondary/accent from primary
    const { h, s, l } = rgbToHsl(...hexToRgb(hex));
    const sec = hslToRgb(h, clamp01(s * 0.9), clamp01(l * 0.8));
    const acc = hslToRgb(h, clamp01(s * 0.7), clamp01(l * 0.6));
    root.style.setProperty('--brand-secondary', rgbToHex(sec.r, sec.g, sec.b));
    root.style.setProperty('--brand-accent', rgbToHex(acc.r, acc.g, acc.b));
    // Map
    root.style.setProperty('--primary-color', getComputedStyle(root).getPropertyValue('--brand-primary').trim());
    root.style.setProperty('--secondary-color', getComputedStyle(root).getPropertyValue('--brand-secondary').trim());
    root.style.setProperty('--accent-color', getComputedStyle(root).getPropertyValue('--brand-accent').trim());
    // Gradients
    const primary = getComputedStyle(root).getPropertyValue('--primary-color').trim();
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${primary}1a, ${primary})`);
}

function hexToRgb(hex) {
    const h = hex.replace('#','');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
}
