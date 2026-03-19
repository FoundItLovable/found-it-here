import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";

type DottedSurfaceProps = Omit<React.ComponentProps<"div">, "ref"> & {
  /** Lower = denser dots. Default tuned for performance. */
  separation?: number;
  /** Dot opacity (0..1). */
  opacity?: number;
};

export function DottedSurface({
  className,
  separation = 150,
  opacity = 0.65,
  ...props
}: DottedSurfaceProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    geometry: THREE.BufferGeometry;
    material: THREE.PointsMaterial;
    points: THREE.Points;
    animationId: number;
    count: number;
    ro?: ResizeObserver;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const AMOUNTX = 40;
    const AMOUNTY = 60;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 2000, 10000);

    const camera = new THREE.PerspectiveCamera(60, 1, 1, 10000);
    camera.position.set(0, 355, 1220);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    renderer.setClearColor(scene.fog.color, 0);

    el.appendChild(renderer.domElement);

    // Geometry
    const positions: number[] = [];
    const colors: number[] = [];
    const geometry = new THREE.BufferGeometry();

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const x = ix * separation - (AMOUNTX * separation) / 2;
        const y = 0;
        const z = iy * separation - (AMOUNTY * separation) / 2;

        positions.push(x, y, z);
        if (theme === "dark") colors.push(0.85, 0.9, 0.92);
        else colors.push(0.1, 0.12, 0.16);
      }
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      transparent: true,
      opacity,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let animationId = 0;
    let count = 0;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (!prefersReducedMotion) {
        const positionAttribute = geometry.attributes.position;
        const arr = positionAttribute.array as Float32Array;

        let i = 0;
        for (let ix = 0; ix < AMOUNTX; ix++) {
          for (let iy = 0; iy < AMOUNTY; iy++) {
            const index = i * 3;
            arr[index + 1] =
              Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
            i++;
          }
        }

        positionAttribute.needsUpdate = true;
        count += 0.1;
      }

      renderer.render(scene, camera);
    };

    animate();

    sceneRef.current = {
      scene,
      camera,
      renderer,
      geometry,
      material,
      points,
      animationId,
      count,
      ro,
    };

    return () => {
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        sceneRef.current.ro?.disconnect();

        sceneRef.current.geometry.dispose();
        sceneRef.current.material.dispose();
        sceneRef.current.renderer.dispose();

        if (el && sceneRef.current.renderer.domElement) {
          el.removeChild(sceneRef.current.renderer.domElement);
        }
      }
    };
  }, [theme, separation, opacity]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none fixed inset-0 -z-10", className)}
      {...props}
    />
  );
}

