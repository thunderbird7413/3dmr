import * as THREE from "three";

class ModelStats {
    constructor() {
        this.stats = null;
    }

    processModel(gltf) {
        document.getElementById("model-status").style.display = "none";
        this.stats = this.calculateModelStats(gltf.scene, gltf.animations);
        this.updateModelStats(this.stats);
    }

    calculateModelStats(model, animations) {
        let faceCount = 0;
        let meshCount = 0;

        const seenMaterials = new Set();
        const seenPBRTextures = new Set();
        const seenOtherTextures = new Set();
        const boundingBox = new THREE.Box3().setFromObject(model);

        model.traverse(function (child) {
            if (child.isMesh) {
                meshCount++;
            }
            if (child.isMesh && child.geometry) {
                if (child.geometry.index) {
                    faceCount += child.geometry.index.count / 3;
                } else if (child.geometry.attributes.position) {
                    faceCount += child.geometry.attributes.position.count / 3;
                }
            }
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material)
                    ? child.material
                    : [child.material];
                materials.forEach((mat) => {
                    seenMaterials.add(mat.uuid);

                    const PBRTextures = [
                        'metalnessMap',
                        'roughnessMap',
                        'normalMap',
                        'aoMap',
                        'emissiveMap',
                        'clearcoatMap',
                        'clearcoatRoughnessMap',
                        'clearcoatNormalMap',
                    ];
                    const otherTextures = [
                        'map',
                        'bumpMap',
                        'displacementMap',
                        'alphaMap',
                        'envMap',
                        'sheenColorMap',
                        'specularMap'
                    ];
                    const allTextures = [
                        ...PBRTextures.map(slot => ({ slot, isPBR: true })),
                        ...otherTextures.map(slot => ({ slot, isPBR: false }))
                    ];

                    allTextures.forEach(({ slot, isPBR }) => {
                        const tex = mat[slot];
                        if (tex && tex.isTexture) {
                            (isPBR ? seenPBRTextures : seenOtherTextures).add(tex.uuid);
                        }
                    });
                });
            }
        });

        const size = boundingBox.getSize(new THREE.Vector3());

        const hasAnimations = Array.isArray(animations) && animations.length > 0;
        const triangleDensity = faceCount / (size.x * size.y * size.z || 1);

        return {
            faces: Math.floor(faceCount),
            volume: size.x * size.y * size.z,
            triangleDensity: triangleDensity.toFixed(2),
            boundingBox: {
                width: size.x.toFixed(2),
                height: size.y.toFixed(2),
                depth: size.z.toFixed(2)
            },
            hasTextures: Boolean(seenPBRTextures.size + seenOtherTextures.size),
            PBRTextureCount: seenPBRTextures.size,
            meshes: meshCount,
            hasAnimations,
        };
    }

    setStatQualityClass(id, quality) {
        const el = document.getElementById(id);
        if (!el) return;

        const classMap = {
            good: "text-success",
            warning: "text-warning",
            bad: "text-danger",
            neutral: "text-muted"
        };
        el.classList.remove(...Object.values(classMap));

        if (quality && classMap[quality]) {
            el.classList.add(classMap[quality]);
        }
    }

    updateModelStats(stats) {
        const fc = stats.faces;
        document.getElementById("faceCount").textContent = fc.toLocaleString("en-US");
        this.setStatQualityClass("faceCount",
            fc <= 5000 ? "good" :
                fc <= 100000 ? "warning" : "bad"
        );

        const hasTextures = stats.hasTextures;
        document.getElementById("hasTextures").textContent = hasTextures ? "Yes" : "No";
        this.setStatQualityClass("hasTextures",
            hasTextures ? "good" : "warning"
        );

        const PBRTextureCount = stats.PBRTextureCount;
        document.getElementById("PBRTextureCount").textContent = PBRTextureCount;
        this.setStatQualityClass("PBRTextureCount",
            PBRTextureCount ? "good" : "warning"
        );

        const mesh = stats.meshes;
        document.getElementById("meshCount").textContent = mesh.toLocaleString("en-US");
        this.setStatQualityClass("meshCount", mesh >= 1 ? "good" : "bad");

        const density = stats.triangleDensity;
        document.getElementById("triangleDensity").innerHTML = density.toLocaleString("en-US") + " triangles/m<sup>3</sup>";
        this.setStatQualityClass("triangleDensity",
            density > 0 && density <= 500 ? "good" :
                density <= 1000 ? "warning" : "bad"
        );

        document.getElementById("boundingBox").textContent =
            `${stats.boundingBox.width}m × ${stats.boundingBox.height}m × ${stats.boundingBox.depth}m`;
        const volume = stats.volume;
        this.setStatQualityClass("boundingBox",
            volume > 0.01 ? "good" :
                volume > 0.001 ? "warning" : "bad"
        );

        document.getElementById("hasAnimations").textContent = stats.hasAnimations ? "Yes" : "No";
    }
}

window.ModelStats = ModelStats;
